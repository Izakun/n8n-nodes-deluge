import { ICredentialType, INodeProperties } from 'n8n-workflow';

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
}
