import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

const TORRENT_FIELDS = [
	'name',
	'state',
	'progress',
	'total_size',
	'download_payload_rate',
	'upload_payload_rate',
	'eta',
	'ratio',
];

export class Deluge implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Deluge',
		name: 'deluge',
		icon: { light: 'file:deluge.svg', dark: 'file:deluge.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Control your Deluge client through its Web JSON-RPC API',
		defaults: { name: 'Deluge' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'delugeApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Get Config', value: 'getConfig', action: 'Get the configuration' },
					{ name: 'Get Filter Tree', value: 'getFilterTree', action: 'Get the filter tree' },
					{ name: 'Get Free Space', value: 'getFreeSpace', action: 'Get the free disk space' },
					{
						name: 'Get Libtorrent Version',
						value: 'getLibtorrentVersion',
						action: 'Get the libtorrent version',
					},
					{ name: 'Get Session State', value: 'getSessionState', action: 'Get the session state' },
					{ name: 'Get Torrents', value: 'getTorrents', action: 'Get many torrents' },
				],
				default: 'getTorrents',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const OP: Record<string, { method: string; params: unknown[] }> = {
			getConfig: { method: 'core.get_config', params: [] },
			getFilterTree: { method: 'core.get_filter_tree', params: [] },
			getFreeSpace: { method: 'core.get_free_space', params: [] },
			getLibtorrentVersion: { method: 'core.get_libtorrent_version', params: [] },
			getSessionState: { method: 'core.get_session_state', params: [] },
			getTorrents: { method: 'core.get_torrents_status', params: [{}, TORRENT_FIELDS] },
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('delugeApi', i);
				const baseURL = (credentials.baseUrl as string).replace(/\/+$/, '');
				const operation = this.getNodeParameter('operation', i) as string;

				const op = OP[operation];
				if (!op) {
					throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, {
						itemIndex: i,
					});
				}

				// Deluge uses a cookie session: log in, then reuse the Set-Cookie value.
				const login = await this.helpers.httpRequestWithAuthentication.call(this, 'delugeApi', {
					method: 'POST' as IHttpRequestMethods,
					baseURL,
					url: '/json',
					body: { method: 'auth.login', params: [credentials.password], id: 1 },
					json: true,
					returnFullResponse: true,
				} as IHttpRequestOptions);

				const setCookie = login.headers['set-cookie'] as string[] | string | undefined;
				const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie ?? ''])
					.map((c) => (c ?? '').split(';')[0])
					.filter(Boolean)
					.join('; ');

				let id = 2;
				const rpc = (method: string, params: unknown[]) =>
					this.helpers.httpRequestWithAuthentication.call(this, 'delugeApi', {
						method: 'POST' as IHttpRequestMethods,
						baseURL,
						url: '/json',
						headers: { Cookie: cookie },
						body: { method, params, id: id++ },
						json: true,
					} as IHttpRequestOptions) as Promise<IDataObject>;

				// The Web UI must be connected to a daemon before core.* methods work.
				const connected = (await rpc('web.connected', [])).result;
				if (!connected) {
					const hosts = (await rpc('web.get_hosts', [])).result as unknown[];
					const first = Array.isArray(hosts) && hosts.length ? (hosts[0] as unknown[]) : undefined;
					const hostId = first ? (first[0] as string) : undefined;
					if (hostId) {
						await rpc('web.connect', [hostId]);
					}
				}

				const result = await rpc(op.method, op.params);
				if (result?.error) {
					throw new NodeApiError(this.getNode(), result as JsonObject, {
						itemIndex: i,
						message: (result.error as IDataObject)?.message as string,
					});
				}
				const data = result?.result;

				if (
					operation === 'getTorrents' &&
					data &&
					typeof data === 'object' &&
					!Array.isArray(data)
				) {
					for (const [hash, torrent] of Object.entries(data as IDataObject)) {
						returnData.push({ json: { hash, ...(torrent as IDataObject) }, pairedItem: { item: i } });
					}
				} else if (data && typeof data === 'object' && !Array.isArray(data)) {
					returnData.push({ json: data as IDataObject, pairedItem: { item: i } });
				} else {
					returnData.push({ json: { result: data } as IDataObject, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
