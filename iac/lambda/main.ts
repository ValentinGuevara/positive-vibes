import { ApiGatewayManagementApi } from "aws-sdk";
import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { S3Client, GetObjectCommand, $ } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchWeatherApi } from "openmeteo";
import fetch from "node-fetch";

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

const streamToString = async (stream: Readable | any): Promise<string> => {
	return await new Promise((resolve, reject) => {
		const chunks: any[] = [];
		stream.on("data", (chunk: any) => chunks.push(chunk));
		stream.on("error", reject);
		stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
	});
};
const getApiGateway = (domainName: string, stage: string) =>
	new ApiGatewayManagementApi({
		endpoint: `${domainName}/${stage}`,
	});

const clientSecret = new SecretsManagerClient({ region: "eu-west-3" });
const s3 = new S3Client({ region: "eu-west-3" });

export const handler = async (
	event: APIGatewayEvent
): Promise<APIGatewayResponse> => {
	const { routeKey, connectionId, domainName, stage } = event.requestContext;
	console.log("Event reçu :", JSON.stringify(event));

	const apiGateway = getApiGateway(domainName, stage);

	switch (routeKey) {
		case "$connect":
			console.log("Connecté :", connectionId);
			return { statusCode: 200 };

		case "$disconnect":
			console.log("Déconnecté :", connectionId);
			return { statusCode: 200 };

		case "$default":
			try {
				if (!process.env.GEMINI_SECRET_ID) {
					console.error(
						"GEMINI_SECRET_ID is not defined in environment variables."
					);
					return { statusCode: 500, body: "Server configuration error" };
				}

				// Fetch FCM tokens
				const commandS3 = new GetObjectCommand({
					Bucket: process.env.BUCKET_NAME,
					Key: "tokens.json",
				});
				const responseS3 = await s3.send(commandS3);
				const body = await streamToString(responseS3.Body);
				const tokens = JSON.parse(body) as string[];
				console.log("FCM tokens :", tokens);
				if (tokens.length === 0) {
					console.log("No FCM tokens available.");
					return { statusCode: 200 };
				}

				const ip = (event.requestContext as any)?.identity?.sourceIp || "";
				const res = await fetch(
					`http://ip-api.com/json/${ip}?fields=country,city,zip,lat,lon`
				);
				const geoData = (await res.json()) as {
					lat: number;
					lon: number;
					city: string;
					zip: string;
					country: string;
				};

				const params = {
					latitude: geoData.lat,
					longitude: geoData.lon,
					current: ["temperature_2m", "weather_code", "is_day"],
				};
				const responses = await fetchWeatherApi(
					"https://api.open-meteo.com/v1/forecast",
					params
				);
				const response = responses[0];

				const utcOffsetSeconds = response.utcOffsetSeconds();
				const current = response.current()!;

				const weatherData = {
					current: {
						time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
						temperature_2m: current.variables(0)!.value(),
						weather_code: current.variables(1)!.value(),
						is_day: current.variables(2)!.value(),
					},
				};

				const command = new GetSecretValueCommand({
					SecretId: process.env.GEMINI_SECRET_ID,
				});
				const responseSecret = await clientSecret.send(command);
				const apiKey = responseSecret.SecretString as string;
				const genAi = new GoogleGenerativeAI(apiKey);
				const prompt = `Ecris une notification courte (max 25 mots), positive et apaisante axée sur le bien-être mental, adaptée au code météo standardisé définie par World Meteorological Organization (${
					weatherData.current.weather_code
				}) avec une temperature de ${
					weatherData.current.temperature_2m
				} degrés celsius en ${
					weatherData.current.is_day === 1 ? "journée" : "pleine nuit"
				}`;
				const model = genAi.getGenerativeModel({ model: "gemini-2.0-flash" });
				console.log(prompt);
				const result = await model.generateContent(prompt);
				const generatedText = result.response.text();
				console.log(generatedText);
				await apiGateway
					.postToConnection({
						ConnectionId: connectionId,
						Data: generatedText,
					})
					.promise();
			} catch (err) {
				console.error("Error :", err);
			}

			return { statusCode: 200 };

		default:
			return { statusCode: 400, body: "Route inconnue" };
	}
};
