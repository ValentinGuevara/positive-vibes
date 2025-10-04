# Shared Light

This project deploys an AWS Lambda function, triggered via API Gateway WebSocket, that sends personalized, weather-based notifications using generative AI. Infrastructure is managed with Terraform.

## Project Structure

```
.
├── .gitignore
├── iac/
│   ├── main.tf                # Terraform configuration
│   ├── terraform.tfstate*     # Terraform state files
│   ├── .terraform/            # Terraform providers
│   ├── tokens.json            # S3-stored FCM tokens
│   └── lambda/
│       ├── main.ts            # Lambda function source (TypeScript)
│       ├── package.json       # Lambda dependencies and build scripts
│       ├── tsconfig.json      # TypeScript config
│       └── lambda.zip         # Built Lambda deployment package
```

## Infrastructure

- **AWS Lambda**: Runs the notification logic ([iac/lambda/main.ts](iac/lambda/main.ts))
- **API Gateway WebSocket**: Triggers Lambda on WebSocket events
- **S3**: Stores FCM tokens
- **Secrets Manager**: Stores Gemini API key
- **IAM**: Roles and policies for Lambda and API Gateway
- **Terraform**: Manages all AWS resources ([iac/main.tf](iac/main.tf))

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

## Environment Variables

Set by Terraform in Lambda:
- `GEMINI_SECRET_ID`: Secrets Manager secret ID for Gemini API key
- `BUCKET_NAME`: S3 bucket for FCM tokens

## License

ISC

---

Author: Valentin Guevara