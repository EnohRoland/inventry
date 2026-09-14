#!/usr/bin/env bash
set -euo pipefail
: "${CLUSTER_NAME:?}" "${VPC_ID:?}" "${EXTERNAL_SECRETS_ROLE_ARN:?}" "${LOAD_BALANCER_ROLE_ARN:?}" "${APPLICATION_SECRET_ARN:?}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$AWS_REGION"
helm repo add eks https://aws.github.io/eks-charts
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system --version 1.14.1 --wait --timeout 10m \
  --set clusterName="$CLUSTER_NAME" --set region="$AWS_REGION" --set vpcId="$VPC_ID" \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$LOAD_BALANCER_ROLE_ARN"
helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace --version 1.3.0 --wait --timeout 10m \
  --set serviceAccount.name=external-secrets \
  --set "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$EXTERNAL_SECRETS_ROLE_ARN"
envsubst '${AWS_REGION} ${APPLICATION_SECRET_ARN}' < deploy/platform.yaml | kubectl apply -f -
kubectl wait --namespace goshenignite --for=condition=Ready externalsecret/inventory-db --timeout=120s
