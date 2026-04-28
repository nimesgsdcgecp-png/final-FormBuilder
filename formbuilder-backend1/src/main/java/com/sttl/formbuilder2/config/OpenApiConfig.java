package com.sttl.formbuilder2.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Form Builder API")
                        .version("1.0")
                        .description("API Documentation for the Form Builder system. This API handles form creation, schema management, submissions, and AI-driven form architecture.")
                        .contact(new Contact()
                                .name("Development Team")
                                .email("dev@sttl.com"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("http://springdoc.org")));
    }
}
