# Shared Light

This project deploys an AWS Lambda function, triggered via API Gateway WebSocket, that sends personalized, weather-based notifications using generative AI. Infrastructure is managed with Terraform.

## Project Structure

```
.
├── .gitignore
├── README.md
├── arduino/
│   └── main/
│       └── main.ino
├── fcm-notif-server/
│   ├── index.js                # Node.js script to send FCM notifications
│   ├── package.json            # Dependencies for FCM server
│   └── serviceAccountKey.json  # Firebase Admin SDK credentials (gitignored)
├── iac/
│   ├── main.tf                # Terraform configuration
│   ├── tokens.json            # S3-stored FCM tokens
│   ├── add-token/
│   │   ├── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api-key-lambda/
│   │   ├── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── process-notif/
│   │   ├── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── websocket-lambda/
│       ├── main.ts
│       ├── package.json
│       └── tsconfig.json
├── notif-sharedlight/
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── README.md
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   └── firebase-messaging-sw.js
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── firebase.js
│       ├── index.css
│       └── main.jsx
```

## Infrastructure

- **AWS Lambda**: Runs the notification logic ([iac/lambda/main.ts](iac/lambda/main.ts))
- **API Gateway WebSocket**: Triggers Lambda on WebSocket events
- **S3**: Stores FCM tokens
- **Secrets Manager**: Stores Gemini API key
- **IAM**: Roles and policies for Lambda and API Gateway
- **Terraform**: Manages all AWS resources ([iac/main.tf](iac/main.tf))

## FCM Notification Server

- Standalone Node.js script to send test notifications via Firebase Admin ([fcm-notif-server/index.js](fcm-notif-server/index.js))
- Requires a Firebase service account key ([fcm-notif-server/serviceAccountKey.json](fcm-notif-server/serviceAccountKey.json), not tracked in git)

## Lambda Function

- Reads FCM tokens from S3
- Gets location from client IP
- Fetches weather data from Open-Meteo
- Generates a notification using Gemini AI
- Sends notification via WebSocket

## Setup

### Prerequisites

- [Terraform](https://www.terraform.io/)
- AWS CLI with credentials configured
- Node.js (v20+ recommended)

### Deploy Infrastructure

```sh
cd iac
terraform init
terraform apply
```

### Build and Deploy Lambda

```sh
cd iac/lambda
npm install
npm run build
# Upload lambda.zip to S3 or let Terraform deploy it as configured
```

### Send Test Notification

```sh
cd fcm-notif-server
npm install
node index.js
```

## Environment Variables

Set by Terraform in Lambda:
- `GEMINI_SECRET_ID`: Secrets Manager secret ID for Gemini API key
- `BUCKET_NAME`: S3 bucket for FCM tokens

## License

ISC

---

Author: Valentin Guevara