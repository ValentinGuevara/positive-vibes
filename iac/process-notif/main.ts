import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { ApiGatewayManagementApi } from "aws-sdk";
import { Readable } from "stream";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchWeatherApi } from "openmeteo";
import fetch from "node-fetch";
import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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

const sendBulkNotification = async (
	app: App,
	tokens: string[],
	title: string,
	body: string
) => {
	const payload = {
		notification: {
			title,
			body,
		},
		apns: {
			payload: {
				aps: {
					sound: "default",
					badge: 1,
				},
			},
		},
		android: {
			notification: {
				sound: "default",
			},
		},
		webpush: {
			fcmOptions: {
				link: "https://google.com",
			},
		},
	};

	const CHUNK_SIZE = 500;

	const allTokens = Array.from(new Set(tokens));

	// Divise les tokens en paquets de 500
	const chunks = [];
	for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
		chunks.push(allTokens.slice(i, i + CHUNK_SIZE));
	}

	console.log(
		`📦 Envoi de ${allTokens.length} tokens en ${chunks.length} chunks`
	);

	// Envoi parallèle des chunks
	const results = await Promise.all(
		chunks.map(async (chunk, index) => {
			try {
				const response = await getMessaging(app).sendEachForMulticast({
					tokens: chunk,
					...payload,
				});

				console.log(
					`Chunk ${index + 1}: ✅ ${response.successCount} envoyés, ❌ ${
						response.failureCount
					} échecs`
				);

				// Récupère les tokens invalides
				const invalidTokens = response.responses
					.map((res: any, j: any) => {
						if (
							!res.success &&
							[
								"messaging/invalid-registration-token",
								"messaging/registration-token-not-registered",
							].includes(res.error?.code)
						) {
							return chunk[j];
						}
						return null;
					})
					.filter(Boolean);

				return { invalidTokens };
			} catch (err) {
				console.error(`Erreur dans le chunk ${index + 1}:`, err);
				return { invalidTokens: [] };
			}
		})
	);

	const invalidTokens = results.flatMap((r) => r.invalidTokens);

	console.log(`🚫 ${invalidTokens.length} tokens invalides détectés`);
	return invalidTokens;
};
const asyncTask = async (
	app: App,
	requestContextWs: any,
	apiGateway: any,
	connectionId: string
) => {
	try {
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

		const ip = requestContextWs?.identity?.sourceIp || "";
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

		//{"apiKey":"uy0rCHQC9uyDzAcEZwhM"}
		let utcOffsetSeconds: any, current: any;
		const controller = new AbortController();
		try {
			const params = {
				latitude: geoData.lat,
				longitude: geoData.lon,
				current: ["temperature_2m", "weather_code", "is_day"],
			};
			setTimeout(() => controller.abort(), 10000);
			const responses = await fetchWeatherApi(
				"https://api.open-meteo.com/v1/forecast",
				params,
				3,
				0.2,
				2,
				{
					signal: controller.signal,
				}
			);
			const response = responses[0];
			utcOffsetSeconds = response.utcOffsetSeconds();
			current = response.current()!;
		} catch (err) {
			if ((err as unknown as any).name === "AbortError") {
				console.log("Request timed out");
			} else {
				console.error("Fetch error:", err);
			}
		}

		let weatherData;
		if (current) {
			weatherData = {
				current: {
					time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
					temperature_2m: current.variables(0)!.value(),
					weather_code: current.variables(1)!.value(),
					is_day: current.variables(2)!.value(),
				},
			};
		}

		const command = new GetSecretValueCommand({
			SecretId: process.env.GEMINI_SECRET_ID,
		});
		const responseSecret = await clientSecret.send(command);
		const apiKey = responseSecret.SecretString as string;
		const genAi = new GoogleGenerativeAI(apiKey);
		const prompt = weatherData
			? `Ecris une notification courte (max 20 mots), positive et apaisante axée sur le bien-être mental, adaptée au code météo standardisé définie par World Meteorological Organization (${
					weatherData.current.weather_code
			  }) avec une temperature de ${
					weatherData.current.temperature_2m
			  } degrés celsius en ${
					weatherData.current.is_day === 1 ? "journée" : "pleine nuit"
			  } dans la ville de ${geoData.city}. Le message ne doit pas faire référence directement au code météo ou à la température, mais doit être en lien avec l'état général du temps et la période de la journée.`
			: `Ecris une notification courte (max 20 mots), positive et apaisante axée sur le bien-être mental, adaptée à la ville de ${geoData.city}. Le message ne doit pas faire référence directement au code météo ou à la température, mais doit être en lien avec l'état général du temps et la période de la journée.`;
		const model = genAi.getGenerativeModel({ model: "gemini-2.0-flash" });
		const result = await model.generateContent(prompt);
		const generatedText = result.response.text();

		const invalidTokens = await sendBulkNotification(
			app,
			tokens,
			"Shared Light",
			generatedText
		);

		await apiGateway
			.postToConnection({
				ConnectionId: connectionId,
				Data: generatedText,
			})
			.promise();

		const newTokenList = tokens.filter((item) => !invalidTokens.includes(item));
		if (newTokenList.length !== tokens.length) {
			// Update tokens in S3
			const putCommand = new PutObjectCommand({
				Bucket: process.env.BUCKET_NAME,
				Key: "tokens.json",
				Body: JSON.stringify(newTokenList),
				ContentType: "application/json",
			});
			await s3.send(putCommand);
			console.log(
				`Updated tokens.json in S3. Removed ${
					tokens.length - newTokenList.length
				} invalid tokens.`
			);
		}
	} catch (err) {
		console.error("Error in asyncTask:", err);
	}
};

const s3 = new S3Client({ region: "eu-west-3" });
const clientSecret = new SecretsManagerClient({ region: "eu-west-3" });

export const handler = async (event: any) => {
	try {
		const _body = event.data;
		console.log("Event reçu :", JSON.stringify(_body));
		const apiGateway = getApiGateway(_body.domainName, _body.stage);
		if (!process.env.GEMINI_SECRET_ID) {
			console.error(
				"GEMINI_SECRET_ID is not defined in environment variables."
			);
			return { statusCode: 500, body: "Server configuration error" };
		}

		if (!process.env.FCM_SERVICE_ACCOUNT) {
			console.error(
				"FCM_SERVICE_ACCOUNT is not defined in environment variables."
			);
			return { statusCode: 500, body: "Server configuration error" };
		}
		const commandFcm = new GetSecretValueCommand({
			SecretId: process.env.FCM_SERVICE_ACCOUNT,
		});
		const responseSecretFcm = await clientSecret.send(commandFcm);
		const serviceAccount = responseSecretFcm.SecretString as string;
		const app = !getApps().length
			? initializeApp({
					credential: cert(JSON.parse(serviceAccount)),
			  })
			: getApp();
		await asyncTask(app, _body.requestContext, apiGateway, _body.connectionId);
		return {
			statusCode: 200,
			body: JSON.stringify({ message: "Notif. sent" }),
		};
	} catch (error) {
		console.error("Error:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};
