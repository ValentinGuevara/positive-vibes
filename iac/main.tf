provider "aws" {
  region  = "eu-west-3"
  profile = "default"
}

resource "aws_iam_role" "lambda_role" {
  name = "lambda_websocket_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_websocket_policy" {
  name = "LambdaWebsocketPolicy"
  role = aws_iam_role.lambda_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      {
        Effect   = "Allow",
        Action   = ["execute-api:ManageConnections"],
        Resource = "${aws_apigatewayv2_api.ws_api.execution_arn}/*/@connections/*"
      },
      {
        Effect   = "Allow",
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.gemini.arn
      },
      {
        Effect   = "Allow",
        Action   = ["s3:PutObject", "s3:GetObject"],
        Resource = "${aws_s3_bucket.fcm.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_secretsmanager_secret" "gemini" {
  name        = "gemini-api-key"
  description = "Clé API Gemini pour Lambda"
}


resource "aws_lambda_function" "shared_light" {
  function_name = "shared_light"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "dist/main.handler"

  filename         = "lambda/lambda.zip"
  source_code_hash = filebase64sha256("lambda/lambda.zip")

  timeout = 120

  environment {
    variables = {
      GEMINI_SECRET_ID = aws_secretsmanager_secret.gemini.id
      BUCKET_NAME      = aws_s3_bucket.fcm.bucket
    }
  }
}

resource "aws_apigatewayv2_api" "ws_api" {
  name                       = "websocket_api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.ws_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}
resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.ws_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.shared_light.invoke_arn
}

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shared_light.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_deployment" "ws_deployment" {
  api_id = aws_apigatewayv2_api.ws_api.id

  depends_on = [
    aws_apigatewayv2_route.default_route
  ]
}

resource "aws_apigatewayv2_stage" "ws_stage" {
  api_id      = aws_apigatewayv2_api.ws_api.id
  name        = "dev"
  auto_deploy = true
}

resource "aws_s3_bucket" "fcm" {
  bucket = "my-tf-fcm-bucket"
}

resource "aws_s3_bucket_ownership_controls" "fcm" {
  bucket = aws_s3_bucket.fcm.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "fcm" {
  depends_on = [aws_s3_bucket_ownership_controls.fcm]

  bucket = aws_s3_bucket.fcm.id
  acl    = "private"
}
