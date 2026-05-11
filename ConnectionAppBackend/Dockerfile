# Stage 1: Build
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B
COPY src src
RUN ./mvnw clean package -DskipTests -B

# Stage 2: Run
FROM eclipse-temurin:21-jre AS run
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
COPY .env .env
ENTRYPOINT ["java", "-jar", "app.jar"]
