{{/*
Expand the name of the chart.
*/}}
{{- define "soma-squad-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "soma-squad-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "soma-squad-ai.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "soma-squad-ai.labels" -}}
helm.sh/chart: {{ include "soma-squad-ai.chart" . }}
{{ include "soma-squad-ai.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: soma-squad-ai
environment: {{ .Values.global.environment }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "soma-squad-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "soma-squad-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API labels
*/}}
{{- define "soma-squad-ai.api.labels" -}}
{{ include "soma-squad-ai.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
API selector labels
*/}}
{{- define "soma-squad-ai.api.selectorLabels" -}}
{{ include "soma-squad-ai.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Worker labels
*/}}
{{- define "soma-squad-ai.worker.labels" -}}
{{ include "soma-squad-ai.labels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Worker selector labels
*/}}
{{- define "soma-squad-ai.worker.selectorLabels" -}}
{{ include "soma-squad-ai.selectorLabels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "soma-squad-ai.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "soma-squad-ai.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Image pull secrets
*/}}
{{- define "soma-squad-ai.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
API image
*/}}
{{- define "soma-squad-ai.api.image" -}}
{{- $registry := .Values.global.imageRegistry | default "docker.io" -}}
{{- $repository := .Values.api.image.repository -}}
{{- $tag := .Values.api.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Worker image
*/}}
{{- define "soma-squad-ai.worker.image" -}}
{{- $registry := .Values.global.imageRegistry | default "docker.io" -}}
{{- $repository := .Values.worker.image.repository -}}
{{- $tag := .Values.worker.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Database URL
*/}}
{{- define "soma-squad-ai.database.url" -}}
{{- $host := .Values.global.database.host -}}
{{- $port := .Values.global.database.port -}}
{{- $database := .Values.global.database.database -}}
{{- printf "postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@%s:%d/%s" $host (int $port) $database -}}
{{- end }}

{{/*
Redis URL
*/}}
{{- define "soma-squad-ai.redis.url" -}}
{{- $host := .Values.global.redis.host -}}
{{- $port := .Values.global.redis.port -}}
{{- if .Values.global.redis.existingSecret -}}
{{- printf "redis://:$(REDIS_PASSWORD)@%s:%d" $host (int $port) -}}
{{- else -}}
{{- printf "redis://%s:%d" $host (int $port) -}}
{{- end -}}
{{- end }}

{{/*
Temporal address
*/}}
{{- define "soma-squad-ai.temporal.address" -}}
{{- $host := .Values.global.temporal.host -}}
{{- $port := .Values.global.temporal.port -}}
{{- printf "%s:%d" $host (int $port) -}}
{{- end }}



