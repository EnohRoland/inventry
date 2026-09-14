#!/usr/bin/env bash
set -euo pipefail
: "${CLUSTER_NAME:?}" "${BACKEND_REPOSITORY:?}" "${FRONTEND_REPOSITORY:?}" "${IMAGE_TAG:?}" "${APP_HOST:?}" "${ACM_CERTIFICATE_ARN:?}"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "${AWS_REGION:-us-east-1}"
kubectl wait --namespace goshenignite --for=condition=Ready externalsecret/inventory-db --timeout=120s
helm upgrade --install inventory deploy/chart --namespace goshenignite --atomic --wait --timeout 10m \
  --set-string backend.repository="$BACKEND_REPOSITORY" --set-string frontend.repository="$FRONTEND_REPOSITORY" \
  --set-string backend.tag="$IMAGE_TAG" --set-string frontend.tag="$IMAGE_TAG" \
  --set-string appOrigin="https://$APP_HOST" --set-string ingress.host="$APP_HOST" \
  --set-string ingress.certificateArn="$ACM_CERTIFICATE_ARN"
kubectl rollout status deployment/backend --namespace goshenignite --timeout=180s
kubectl rollout status deployment/frontend --namespace goshenignite --timeout=180s
curl --fail --silent --show-error --retry 8 --retry-delay 5 "https://$APP_HOST/api/health/ready"
