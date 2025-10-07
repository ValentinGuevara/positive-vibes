import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3 = new S3Client({ region: "eu-west-3" });

const streamToString = async (stream: Readable | any): Promise<string> => {
	return await new Promise((resolve, reject) => {
		const chunks: any[] = [];
		stream.on("data", (chunk: any) => chunks.push(chunk));
		stream.on("error", reject);
		stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
	});
};

export const handler = async (event: any) => {
	try {
		const body =
			typeof event.body === "string" ? JSON.parse(event.body) : event.body;
		const token = body?.token;

		if (!token) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Missing token" }),
			};
		}

		const commandS3 = new GetObjectCommand({
			Bucket: process.env.BUCKET_NAME,
			Key: "tokens.json",
		});
		const responseS3 = await s3.send(commandS3);
		const tokensBody = await streamToString(responseS3.Body);
		const tokens = JSON.parse(tokensBody) as string[];

		const _s = new Set(tokens);
		_s.add(token);

		const putCmd = new PutObjectCommand({
			Bucket: process.env.BUCKET_NAME,
			Key: `tokens.json`,
			Body: JSON.stringify(Array.from(_s)),
			ContentType: "application/json",
		});

		await s3.send(putCmd);

		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type,x-api-key",
				"Access-Control-Allow-Methods": "POST,OPTIONS",
			},
			body: JSON.stringify({ message: "Token stored successfully", token }),
		};
	} catch (error) {
		console.error("Error saving token:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};
