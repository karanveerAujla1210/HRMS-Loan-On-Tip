/**
 * @hrms/api-contract — the shared contract between database, server, web and
 * mobile. Neither the web app nor the mobile app may invent its own request or
 * response shapes; everything flows through this package.
 */
export * from "./errors";
export * from "./enums";
export * from "./rbac";
export * from "./response";
export * from "./schemas";
