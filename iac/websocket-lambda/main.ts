import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

interface APIGatewayEvent {
	requestContext: {
		routeKey: string;
		connectionId: string;
		domainName: string;
		stage: string;
	};
	body?: string;
}

interface APIGatewayResponse {
	statusCode: number;
	body?: string;
}

const lambda = new LambdaClient({ region: "eu-west-3" });
const clientSecret = new SecretsManagerClient({ region: "eu-west-3" });
export const handler = async (
	event: APIGatewayEvent
): Promise<APIGatewayResponse> => {
	const { routeKey, connectionId, domainName, stage } = event.requestContext;

	let _body;
	if (event.body) {
		_body = JSON.parse(event.body as string);
		_body.connectionId = connectionId;
		_body.domainName = domainName;
		_body.stage = stage;
		_body.requestContext = event.requestContext;
		console.log("Event reçu :", JSON.stringify(event));
	}

	const commandWebsocket = new GetSecretValueCommand({
		SecretId: process.env.WS_SECRET_ID,
	});
	const responseWebsocket = await clientSecret.send(commandWebsocket);
	const apiKeyWebsocket = responseWebsocket.SecretString as string;

	switch (routeKey) {
		case "$connect":
			console.log("Connecté :", connectionId);
			return { statusCode: 200 };

		case "$disconnect":
			console.log("Déconnecté :", connectionId);
			return { statusCode: 200 };

		case "$default":
			try {
				if (!_body.apiKey || _body.apiKey !== apiKeyWebsocket) {
					console.log("Bad API key - not connected");
					return { statusCode: 401, body: "Unauthorized" };
				}
				delete _body["apiKey"];
				const payload = {
					message: "Start background task",
					data: _body,
				};
				await lambda.send(
					new InvokeCommand({
						FunctionName: process.env.BACKGROUND_LAMBDA_NAME,
						InvocationType: "Event",
						Payload: Buffer.from(JSON.stringify(payload)),
					})
				);
				return { statusCode: 200, body: "Async task started" };
			} catch (err) {
				console.error("Error :", err);
			}

			return { statusCode: 200 };

		default:
			return { statusCode: 400, body: "Route inconnue" };
	}
};
