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
					{ name: 'Get Torrents', value: 'getTorrents', action: 'Get many torrents' },
				],
				default: 'getTorrents',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const RPC_BY_OP: Record<string, { method: string; params: unknown[] }> = {
			getConfig: { method: 'core.get_config', params: [] },
			getTorrents: { method: 'core.get_torrents_status', params: [{}, TORRENT_FIELDS] },
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('delugeApi', i);
				const baseURL = (credentials.baseUrl as string).replace(/\/+$/, '');
				const operation = this.getNodeParameter('operation', i) as string;

				const rpc = RPC_BY_OP[operation];
				if (!rpc) {
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

				const result = (await this.helpers.httpRequestWithAuthentication.call(this, 'delugeApi', {
					method: 'POST' as IHttpRequestMethods,
					baseURL,
					url: '/json',
					headers: { Cookie: cookie },
					body: { method: rpc.method, params: rpc.params, id: 2 },
					json: true,
				} as IHttpRequestOptions)) as IDataObject;

				const data = result?.result as IDataObject;
				if (operation === 'getTorrents' && data && typeof data === 'object') {
					for (const [hash, torrent] of Object.entries(data)) {
						returnData.push({
							json: { hash, ...(torrent as IDataObject) },
							pairedItem: { item: i },
						});
					}
				} else {
					returnData.push({ json: (data ?? result) as IDataObject, pairedItem: { item: i } });
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
