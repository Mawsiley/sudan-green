FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl ca-certificates zip unzip \
 && rm -rf /var/lib/apt/lists/*

ARG APKTOOL_VERSION=2.10.0
ARG SIGNER_VERSION=1.3.0
RUN mkdir -p /opt/tools \
 && curl -fsSL -o /opt/tools/apktool.jar \
    https://github.com/iBotPeaches/Apktool/releases/download/v${APKTOOL_VERSION}/apktool_${APKTOOL_VERSION}.jar \
 && curl -fsSL -o /opt/tools/uber-apk-signer.jar \
    https://github.com/patrickfav/uber-apk-signer/releases/download/v${SIGNER_VERSION}/uber-apk-signer-${SIGNER_VERSION}.jar

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV APKTOOL_JAR=/opt/tools/apktool.jar \
    SIGNER_JAR=/opt/tools/uber-apk-signer.jar \
    WORK_DIR=/tmp/apk-lab \
    PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
