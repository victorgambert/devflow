#!/bin/bash

# Test de synchronisation Notion avec DevFlow
echo "🔄 Test de synchronisation d'un ticket Notion..."
echo ""

TASK_ID="29faeed8482c8024af0df22cf5d3c35c"
API_URL="http://localhost:3000/api/v1"

echo "📋 ID du ticket: $TASK_ID"
echo "🌐 API URL: $API_URL"
echo ""

# Test 1: Sync du ticket Notion
echo "1️⃣ Synchronisation du ticket depuis Notion..."
SYNC_RESPONSE=$(curl -s -X POST "$API_URL/tasks/sync/notion" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\": \"$TASK_ID\"}")

echo "Réponse:"
echo "$SYNC_RESPONSE" | jq . 2>/dev/null || echo "$SYNC_RESPONSE"
echo ""

# Test 2: Démarrage du workflow
echo "2️⃣ Démarrage du workflow DevFlow..."
WORKFLOW_RESPONSE=$(curl -s -X POST "$API_URL/workflows/start" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\": \"$TASK_ID\", \"projectId\": \"default-project\"}")

echo "Réponse:"
echo "$WORKFLOW_RESPONSE" | jq . 2>/dev/null || echo "$WORKFLOW_RESPONSE"
echo ""

# Extraire le workflow ID si possible
WORKFLOW_ID=$(echo "$WORKFLOW_RESPONSE" | jq -r '.workflowId' 2>/dev/null)

if [ "$WORKFLOW_ID" != "null" ] && [ -n "$WORKFLOW_ID" ]; then
  echo "✅ Workflow démarré avec succès!"
  echo "🔍 Workflow ID: $WORKFLOW_ID"
  echo "📊 Voir les détails: http://localhost:8080/namespaces/default/workflows/$WORKFLOW_ID"
else
  echo "⚠️  Erreur lors du démarrage du workflow"
fi

echo ""
echo "✨ Test terminé!"
