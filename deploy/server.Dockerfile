FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /workspace
COPY server/.mvn server/.mvn
COPY server/mvnw server/pom.xml server/
RUN cd server && sh mvnw -q -DskipTests dependency:go-offline
COPY server/src server/src
RUN cd server && sh mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system smartstore \
    && useradd --system --gid smartstore --home-dir /app smartstore
WORKDIR /app
COPY --from=build /workspace/server/target/smart-store-server-0.0.1-SNAPSHOT.jar app.jar
RUN mkdir -p /data/uploads && chown -R smartstore:smartstore /app /data/uploads
USER smartstore
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
