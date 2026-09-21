FROM eclipse-temurin:25-jre-noble
WORKDIR /app
COPY build/libs/blariyo-collector-0.1.0.jar /app/collector.jar
USER 10001:10001
ENTRYPOINT ["java", "-jar", "/app/collector.jar"]
