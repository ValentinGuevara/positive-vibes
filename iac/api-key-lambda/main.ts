import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
	region: process.env.AWS_REGION || "eu-west-1",
});

export const handler = async (event: any = {}): Promise<any> => {
	try {
		const command = new GetSecretValueCommand({
			SecretId: process.env.WS_SECRET_ID,
		});
		const response = await client.send(command);

		let secretValue: string;
		if ("SecretString" in response && response.SecretString) {
			secretValue = response.SecretString;
		} else {
			secretValue = Buffer.from(response.SecretBinary as Uint8Array).toString(
				"utf-8"
			);
		}

		console.log("Secret récupéré avec succès");

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Secret fetched successfully",
				secret: secretValue,
			}),
		};
	} catch (error: any) {
		console.error("Erreur SecretsManager:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: error.message }),
		};
	}
};
