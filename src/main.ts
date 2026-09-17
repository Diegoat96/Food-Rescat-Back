import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { mkdirSync } from "fs";
import { join } from "path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import { TransformResponseInterceptor } from "./common/interceptors/transform-response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const uploadsRoot =
    process.env.UPLOADS_ROOT ?? join(process.cwd(), "uploads");
  mkdirSync(join(uploadsRoot, "business-licenses"), { recursive: true });
  mkdirSync(join(uploadsRoot, "business-photos"), { recursive: true });
  mkdirSync(join(uploadsRoot, "package-images"), { recursive: true });

  app.setGlobalPrefix("api");
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  app.useGlobalInterceptors(new TransformResponseInterceptor());

  const corsOrigin = configService.get<string>(
    "CORS_ORIGIN",
    "http://localhost:4200",
  );
  const corsOrigins = corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Foodrescat API")
    .setDescription(
      "Foodrescat REST API documentation.\n\n" +
        'Response envelope: successful calls return `{ "success": true, "data": ... }`; ' +
        'errors return `{ "success": false, "statusCode": ..., "message": ..., "error": ... }`.\n\n' +
        "Ownership contract: a resource that exists but is not yours returns **403**; " +
        "a resource that does not exist returns **404**.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = configService.get<number>('port', 3001);
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
