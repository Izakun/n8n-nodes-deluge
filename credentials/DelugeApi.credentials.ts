import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DelugeApi implements ICredentialType {
	name = 'delugeApi';

	displayName = 'Deluge API';

	icon = 'file:delugeApi.svg' as const;

	documentationUrl = 'https://deluge.readthedocs.io/en/latest/reference/web.html';

	// Deluge's Web JSON-RPC uses cookie-based sessions: the node logs in with the
	// password and reuses the returned session cookie, so no authenticate block.
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://deluge:8112',
			required: true,
			description: 'Base URL of the Deluge Web UI (e.g. http://deluge:8112). No trailing slash.',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Deluge Web UI password',
		},
	];

	// Deluge Web JSON-RPC: auth.login returns { result: true } on success.
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			baseURL: '={{$credentials.baseUrl}}',
			url: '/json',
			body: {
				id: 1,
				method: 'auth.login',
				params: ['={{$credentials.password}}'],
			},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'result',
					value: false,
					message: 'Login failed — check the Deluge Web UI password.',
				},
			},
		],
	};

	// No transport auth to inject here (handled inside the node); this block
	// lets the node use httpRequestWithAuthentication.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};
}
