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
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.websocket.arn
      },
      {
        Effect   = "Allow",
        Action   = ["lambda:InvokeFunction"],
        Resource = aws_lambda_function.send_notification.arn
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

resource "aws_secretsmanager_secret" "websocket" {
  name        = "websocket-api-key"
  description = "Clé API Websocket pour Lambda"
}

resource "aws_secretsmanager_secret" "service_account_fcm" {
  name        = "service-account-fcm"
  description = "Service account FCM json"
}

resource "aws_lambda_function" "shared_light" {
  function_name = "shared_light"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "dist/main.handler"

  filename         = "websocket-lambda/lambda.zip"
  source_code_hash = filebase64sha256("websocket-lambda/lambda.zip")

  timeout = 120

  environment {
    variables = {
      WS_SECRET_ID           = aws_secretsmanager_secret.websocket.id
      BACKGROUND_LAMBDA_NAME = aws_lambda_function.send_notification.function_name
    }
  }
}

resource "aws_iam_role" "lambda_notif_role" {
  name = "lambda_notif_role"
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

resource "aws_iam_role_policy" "lambda_send_notif_policy" {
  name = "LambdaSendNotifPolicy"
  role = aws_iam_role.lambda_notif_role.name

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
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.service_account_fcm.arn
      },
      {
        Effect   = "Allow",
        Action   = ["s3:GetObject", "s3:PutObject"],
        Resource = "${aws_s3_bucket.fcm.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_notif_logs" {
  role       = aws_iam_role.lambda_notif_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "send_notification" {
  function_name = "send_notification"
  role          = aws_iam_role.lambda_notif_role.arn
  runtime       = "nodejs20.x"
  handler       = "dist/main.handler"

  filename         = "process-notif/lambda.zip"
  source_code_hash = filebase64sha256("process-notif/lambda.zip")

  timeout     = 120
  memory_size = 1024

  environment {
    variables = {
      GEMINI_SECRET_ID    = aws_secretsmanager_secret.gemini.id
      FCM_SERVICE_ACCOUNT = aws_secretsmanager_secret.service_account_fcm.id
      BUCKET_NAME         = aws_s3_bucket.fcm.bucket
    }
  }
}

resource "aws_iam_role" "lambda_add_token_role" {
  name = "lambda_add_token_role"
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

resource "aws_iam_role_policy" "lambda_add_token_policy" {
  name = "LambdaAddTokenPolicy"
  role = aws_iam_role.lambda_add_token_role.name

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
        Action   = ["s3:GetObject", "s3:PutObject"],
        Resource = "${aws_s3_bucket.fcm.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_add_token_logs" {
  role       = aws_iam_role.lambda_add_token_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_lambda_function" "add_token" {
  function_name = "add_token"
  role          = aws_iam_role.lambda_add_token_role.arn
  runtime       = "nodejs20.x"
  handler       = "dist/main.handler"

  filename         = "add-token/lambda.zip"
  source_code_hash = filebase64sha256("add-token/lambda.zip")

  timeout = 120

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.fcm.bucket
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

####### Get API Key ########
resource "aws_iam_role" "lambda_exec" {
  name = "lambda_get_apikey_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_policy" {
  name = "lambda_get_apikey_policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.websocket.arn
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

resource "aws_lambda_function" "get_api_key" {
  function_name = "getApiKeyFunction"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs20.x"
  handler       = "dist/main.handler"

  filename         = "api-key-lambda/lambda.zip"
  source_code_hash = filebase64sha256("api-key-lambda/lambda.zip")

  timeout = 10

  environment {
    variables = {
      WS_SECRET_ID = aws_secretsmanager_secret.websocket.id
    }
  }
}

resource "aws_api_gateway_rest_api" "api" {
  name        = "ApiKeyAPI"
  description = "Expose une Lambda pour gérer une API Key"
}

resource "aws_api_gateway_resource" "getkey" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "key"
}

resource "aws_api_gateway_method" "getkey_method" {
  rest_api_id      = aws_api_gateway_rest_api.api.id
  resource_id      = aws_api_gateway_resource.getkey.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "getkey_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.getkey.id
  http_method             = aws_api_gateway_method.getkey_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_api_key.invoke_arn
}

resource "aws_api_gateway_method" "addtoken_method" {
  rest_api_id      = aws_api_gateway_rest_api.api.id
  resource_id      = aws_api_gateway_resource.getkey.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "addtoken_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.getkey.id
  http_method             = aws_api_gateway_method.addtoken_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.add_token.invoke_arn
}

resource "aws_lambda_permission" "allow_add_token_apigw" {
  statement_id  = "AllowAPIGatewayAddTokenInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.add_token.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Méthode OPTIONS pour CORS
resource "aws_api_gateway_method" "options_token" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.getkey.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Réponse MOCK pour OPTIONS
resource "aws_api_gateway_integration" "options_token_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.getkey.id
  http_method = aws_api_gateway_method.options_token.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Réponse CORS
resource "aws_api_gateway_method_response" "options_method_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.getkey.id
  http_method = aws_api_gateway_method.options_token.http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}
resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.getkey.id
  http_method = aws_api_gateway_method.options_token.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST,GET'"
  }
}

resource "aws_api_gateway_deployment" "api_deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  # Forcer redéploiement à chaque changement
  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.getkey_integration,
    aws_api_gateway_integration.addtoken_integration,
    aws_api_gateway_integration.options_token_integration
  ]
}

resource "aws_api_gateway_stage" "prod" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api_deploy.id
  stage_name    = "prod"
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_api_key.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_api_key" "api_key" {
  name = "my-api-key"
}

resource "aws_api_gateway_usage_plan" "api_key" {
  name = "iot"
  api_stages {
    api_id = aws_api_gateway_rest_api.api.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }
}

resource "aws_api_gateway_usage_plan_key" "api_key" {
  key_id        = aws_api_gateway_api_key.api_key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.api_key.id
}

######## PWA ##########
resource "aws_s3_bucket" "site" {
  bucket        = "shared-light-pwa-web"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

data "aws_caller_identity" "current" {}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "shared-light-oac"
  description                       = "OAC for S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "allow_cloudfront_get" {
  statement {
    actions = ["s3:GetObject"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity"]
    }

    resources = [
      "${aws_s3_bucket.site.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

variable "cloudfront_certificate_arn" {
  type    = string
  default = ""
}

variable "domain_names" {
  type    = list(string)
  default = []
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled = true
  aliases = var.domain_names

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "shared-light-oac"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "shared-light-oac"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Error responses: return index.html for SPA routing (React Router)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  price_class = "PriceClass_100"

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site_policy" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket_policy.json
}
