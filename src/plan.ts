import * as fs from "node:fs";
import * as path from "node:path";

export const PLAN_KIND = "miniapp-test-plan";
export const PLAN_VERSION = 1;
export const AUTO_SCREENSHOT_MODES = Object.freeze(["off", "on-success", "always"] as const);
export const SUPPORTED_STEP_TYPES = Object.freeze([
  "session.start",
  "page.read",
  "element.query",
  "element.click",
  "element.input",
  "wait.for",
  "network.listen.start",
  "network.listen.stop",
  "network.listen.clear",
  "network.wait",
  "assert.pagePath",
  "assert.elementText",
  "assert.elementVisible",
  "assert.networkRequest",
  "assert.networkResponse",
  "gesture.touchStart",
  "gesture.touchMove",
  "gesture.touchTap",
  "gesture.touchEnd",
  "network.intercept.add",
  "network.intercept.remove",
  "network.intercept.clear",
  "storage.set",
  "storage.get",
  "storage.info",
  "storage.remove",
  "storage.clear",
  "navigation.navigateTo",
  "navigation.redirectTo",
  "navigation.reLaunch",
  "navigation.switchTab",
  "navigation.back",
  "app.getLaunchOptions",
  "app.getSystemInfo",
  "app.getAccountInfo",
  "settings.get",
  "settings.authorize",
  "settings.open",
  "clipboard.set",
  "clipboard.get",
  "ui.showToast",
  "ui.hideToast",
  "ui.showLoading",
  "ui.hideLoading",
  "ui.showModal",
  "ui.showActionSheet",
  "location.get",
  "location.choose",
  "location.open",
  "media.chooseImage",
  "media.chooseMedia",
  "media.takePhoto",
  "media.getImageInfo",
  "media.saveImageToPhotosAlbum",
  "file.stage",
  "file.upload",
  "file.download",
  "device.scanCode",
  "device.makePhoneCall",
  "auth.login",
  "auth.checkSession",
  "subscription.requestMessage",
  "artifact.screenshot",
  "session.close",
] as const);

export type SupportedStepType = (typeof SUPPORTED_STEP_TYPES)[number];
export type AutoScreenshotMode = (typeof AUTO_SCREENSHOT_MODES)[number];

export interface PlanStepInput {
  [key: string]: unknown;
}

export interface PlanStep {
  id: string;
  type: SupportedStepType | string;
  input: PlanStepInput;
}

export interface PlanSource {
  type: string;
  prompt: string;
}

export interface PlanPlanner {
  mode: string;
  notes: string[];
}

export interface PlanMetadata {
  name: string;
  draft: boolean;
  source?: PlanSource;
  planner?: PlanPlanner;
}

export interface PlanEnvironment {
  projectPath: string | null;
  artifactsDir: string | null;
  wechatDevtoolPath: string | null;
  testPort: number;
  language: string;
  autoScreenshot?: AutoScreenshotMode | string;
  runtimeMode?: string;
  sessionTimeoutSeconds?: number;
}

export interface PlanExecution {
  mode: "serial" | string;
  failFast: boolean;
}

export interface Plan {
  version: number;
  kind: string;
  createdAt?: string;
  metadata: PlanMetadata;
  environment: PlanEnvironment;
  execution: PlanExecution;
  steps: PlanStep[];
}

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
}

export interface LoadedPlan {
  plan: Plan;
  path: string;
}

const NO_INPUT_REQUIRED_STEP_TYPES = new Set<SupportedStepType>([
  "page.read",
  "storage.info",
  "storage.clear",
  "app.getLaunchOptions",
  "app.getSystemInfo",
  "app.getAccountInfo",
  "settings.get",
  "settings.open",
  "clipboard.get",
  "ui.hideToast",
  "ui.hideLoading",
  "location.get",
  "location.choose",
  "media.chooseImage",
  "media.chooseMedia",
  "media.takePhoto",
  "device.scanCode",
  "auth.login",
  "auth.checkSession",
  "network.listen.clear",
  "network.intercept.clear",
]);

const BRIDGE_STEP_TYPES = new Set<SupportedStepType>([
  "storage.set",
  "storage.get",
  "storage.info",
  "storage.remove",
  "storage.clear",
  "navigation.navigateTo",
  "navigation.redirectTo",
  "navigation.reLaunch",
  "navigation.switchTab",
  "navigation.back",
  "app.getLaunchOptions",
  "app.getSystemInfo",
  "app.getAccountInfo",
  "settings.get",
  "settings.authorize",
  "settings.open",
  "clipboard.set",
  "clipboard.get",
  "ui.showToast",
  "ui.hideToast",
  "ui.showLoading",
  "ui.hideLoading",
  "ui.showModal",
  "ui.showActionSheet",
  "location.get",
  "location.choose",
  "location.open",
  "media.chooseImage",
  "media.chooseMedia",
  "media.takePhoto",
  "media.getImageInfo",
  "media.saveImageToPhotosAlbum",
  "file.stage",
  "file.upload",
  "file.download",
  "device.scanCode",
  "device.makePhoneCall",
  "auth.login",
  "auth.checkSession",
  "subscription.requestMessage",
]);

const NETWORK_MATCHER_RESOURCE_TYPES = new Set(["request", "upload", "download"]);
const NETWORK_WAIT_EVENTS = new Set(["request", "response"]);
const NETWORK_INTERCEPT_ACTIONS = new Set(["continue", "fail", "delay", "mock"]);
const NETWORK_MATCHER_KEYS = new Set([
  "url",
  "urlPattern",
  "method",
  "resourceType",
  "query",
  "headers",
  "body",
  "statusCode",
  "responseHeaders",
  "responseBody",
] as const);

export class PlanValidationError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "PlanValidationError";
    this.details = details;
  }
}

export function loadPlanFromFile(filePath: string): LoadedPlan {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  return loadPlanFromJson(raw, {
    baseDir: path.dirname(resolvedPath),
    sourcePath: resolvedPath,
  });
}

export function loadPlanFromJson(
  raw: string,
  options: { baseDir?: string; sourcePath?: string } = {},
): LoadedPlan {
  const baseDir = path.resolve(options.baseDir || process.cwd());
  const sourcePath = options.sourcePath ? path.resolve(options.sourcePath) : "<inline-json>";
  let plan: Plan;
  try {
    plan = JSON.parse(raw) as Plan;
  } catch (error) {
    throw new PlanValidationError(`Plan input is not valid JSON: ${sourcePath}`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const validation = validatePlan(plan);
  if (!validation.ok) {
    throw new PlanValidationError(`Plan validation failed: ${sourcePath}`, validation.errors);
  }

  return {
    plan: normalizeLoadedPlanPaths(plan, baseDir),
    path: sourcePath,
  };
}

function normalizeLoadedPlanPaths(plan: Plan, baseDir: string): Plan {
  const resolveMaybe = (value: unknown): string | null => {
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }
    return path.resolve(baseDir, value);
  };

  return {
    ...plan,
    environment: {
      ...plan.environment,
      projectPath: resolveMaybe(plan.environment.projectPath),
      artifactsDir: resolveMaybe(plan.environment.artifactsDir),
      wechatDevtoolPath: resolveMaybe(plan.environment.wechatDevtoolPath),
    },
    steps: plan.steps.map((step) => {
      if (step.type !== "session.start" || typeof step.input.projectPath !== "string") {
        return step;
      }
      return {
        ...step,
        input: {
          ...step.input,
          projectPath: path.resolve(baseDir, step.input.projectPath),
        },
      };
    }),
  };
}

export function validatePlan(
  plan: unknown,
  options: { allowDraft?: boolean } = {},
): PlanValidationResult {
  const errors: string[] = [];
  const allowDraft = options.allowDraft === true;

  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("The plan root must be a JSON object.");
    return { ok: false, errors };
  }

  const typedPlan = plan as Partial<Plan>;

  if (typedPlan.version !== PLAN_VERSION) {
    errors.push(`Plan version must be ${PLAN_VERSION}.`);
  }
  if (typedPlan.kind !== PLAN_KIND) {
    errors.push(`Plan kind must be \`${PLAN_KIND}\`.`);
  }

  if (!typedPlan.execution || typeof typedPlan.execution !== "object") {
    errors.push("The plan is missing an `execution` object.");
  } else {
    if (typedPlan.execution.mode !== "serial") {
      errors.push("Only `execution.mode = serial` is supported right now.");
    }
    if (typeof typedPlan.execution.failFast !== "boolean") {
      errors.push("`execution.failFast` must be a boolean.");
    }
  }

  const autoScreenshot = typedPlan.environment?.autoScreenshot;
  if (
    autoScreenshot !== undefined &&
    !AUTO_SCREENSHOT_MODES.includes(String(autoScreenshot) as AutoScreenshotMode)
  ) {
    errors.push("`environment.autoScreenshot` must be one of `off`, `on-success`, or `always`.");
  }

  if (!Array.isArray(typedPlan.steps)) {
    errors.push("The plan is missing a `steps` array.");
  } else if (typedPlan.steps.length === 0 && !allowDraft) {
    errors.push("A runnable plan must contain at least one step.");
  }

  const draft = Boolean(typedPlan.metadata && typedPlan.metadata.draft);
  if (Array.isArray(typedPlan.steps)) {
    const seenStepIds = new Set<string>();
    for (const [index, step] of typedPlan.steps.entries()) {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        errors.push(`steps[${index}] must be an object.`);
        continue;
      }
      if (!step.id || typeof step.id !== "string") {
        errors.push(`steps[${index}] must include a string id.`);
      } else if (seenStepIds.has(step.id)) {
        errors.push(`steps[${index}] id must be unique: ${JSON.stringify(step.id)}.`);
      } else {
        seenStepIds.add(step.id);
      }
      if (!SUPPORTED_STEP_TYPES.includes(step.type as SupportedStepType)) {
        errors.push(`steps[${index}] uses an unsupported type: ${JSON.stringify(step.type)}`);
      }
      const supportedStepType = step.type as SupportedStepType;
      if (
        !NO_INPUT_REQUIRED_STEP_TYPES.has(supportedStepType) &&
        (!step.input || typeof step.input !== "object" || Array.isArray(step.input))
      ) {
        errors.push(`steps[${index}] must include an object input.`);
        continue;
      }
      if (!step.input || typeof step.input !== "object" || Array.isArray(step.input)) {
        step.input = {};
      }
      validateStepShape(step, index, typedPlan, errors);
    }
  }

  if (!allowDraft && draft) {
    errors.push("`exec` does not accept draft plans; fill in the execution context first.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateStepShape(step: PlanStep, index: number, plan: Partial<Plan>, errors: string[]): void {
  validateBridgeCommonShape(step, index, errors);

  switch (step.type) {
    case "session.start": {
      const effectiveProjectPath =
        typeof step.input.projectPath === "string"
          ? step.input.projectPath
          : plan.environment?.projectPath;
      if (!effectiveProjectPath) {
        errors.push(
          `steps[${index}] session.start requires \`input.projectPath\` or root-level \`environment.projectPath\`.`,
        );
      }
      break;
    }
    case "element.query":
    case "element.click":
    case "element.input":
    case "assert.elementText":
    case "assert.elementVisible": {
      if (!step.input.locator || typeof step.input.locator !== "object") {
        errors.push(`steps[${index}] ${step.type} requires a locator.`);
      }
      if (step.type === "element.input" && typeof step.input.text !== "string") {
        errors.push(`steps[${index}] element.input requires a string text value.`);
      }
      if (step.type === "assert.elementText" && typeof step.input.expectedText !== "string") {
        errors.push(`steps[${index}] assert.elementText requires a string expectedText value.`);
      }
      break;
    }
    case "wait.for": {
      if (!step.input.condition || typeof step.input.condition !== "object") {
        errors.push(`steps[${index}] wait.for requires a condition object.`);
      }
      break;
    }
    case "network.listen.start": {
      requireOptionalStringField(step, index, "listenerId", errors);
      requireOptionalBooleanField(step, index, "captureResponses", errors);
      requireOptionalNumberField(step, index, "maxEvents", errors);
      validateNetworkMatcher(step.input.matcher, `steps[${index}] network.listen.start matcher`, errors);
      break;
    }
    case "network.listen.stop": {
      requireStringField(step, index, "listenerId", errors);
      break;
    }
    case "network.listen.clear": {
      requireOptionalStringField(step, index, "listenerId", errors);
      break;
    }
    case "network.wait": {
      requireOptionalStringField(step, index, "listenerId", errors);
      requireOptionalEnumField(step, index, "event", NETWORK_WAIT_EVENTS, errors);
      requireOptionalNumberField(step, index, "timeoutMs", errors);
      validateNetworkMatcher(step.input.matcher, `steps[${index}] network.wait matcher`, errors);
      if (step.input.listenerId === undefined && step.input.matcher === undefined) {
        errors.push(`steps[${index}] network.wait requires listenerId or matcher.`);
      }
      break;
    }
    case "assert.pagePath": {
      if (typeof step.input.expectedPath !== "string") {
        errors.push(`steps[${index}] assert.pagePath requires expectedPath.`);
      }
      break;
    }
    case "gesture.touchStart":
    case "gesture.touchMove":
    case "gesture.touchTap":
    case "gesture.touchEnd": {
      if (typeof step.input.pointerId !== "number") {
        errors.push(`steps[${index}] ${step.type} requires a numeric pointerId.`);
      }
      if (
        step.type !== "gesture.touchEnd" &&
        !step.input.locator &&
        !(typeof step.input.x === "number" && typeof step.input.y === "number")
      ) {
        errors.push(`steps[${index}] ${step.type} requires a locator or x/y coordinates.`);
      }
      break;
    }
    case "storage.set": {
      requireStringField(step, index, "key", errors);
      if (!Object.prototype.hasOwnProperty.call(step.input, "value")) {
        errors.push(`steps[${index}] storage.set requires a value field.`);
      }
      break;
    }
    case "storage.get":
    case "storage.remove": {
      requireStringField(step, index, "key", errors);
      break;
    }
    case "navigation.navigateTo":
    case "navigation.redirectTo":
    case "navigation.reLaunch":
    case "navigation.switchTab": {
      requireStringField(step, index, "url", errors);
      requireOptionalNumberField(step, index, "timeoutMs", errors);
      break;
    }
    case "navigation.back": {
      requireOptionalNumberField(step, index, "delta", errors);
      requireOptionalNumberField(step, index, "timeoutMs", errors);
      break;
    }
    case "settings.authorize": {
      requireStringField(step, index, "scope", errors);
      break;
    }
    case "clipboard.set": {
      requireStringField(step, index, "text", errors);
      break;
    }
    case "ui.showToast": {
      requireStringField(step, index, "title", errors);
      requireOptionalNumberField(step, index, "duration", errors);
      break;
    }
    case "ui.showLoading": {
      requireStringField(step, index, "title", errors);
      break;
    }
    case "ui.showModal": {
      requireStringField(step, index, "title", errors);
      requireStringField(step, index, "content", errors);
      break;
    }
    case "ui.showActionSheet": {
      if (!Array.isArray(step.input.itemList) || step.input.itemList.length === 0) {
        errors.push(`steps[${index}] ui.showActionSheet requires a non-empty itemList array.`);
      } else if (step.input.itemList.some((item) => typeof item !== "string" || item.trim() === "")) {
        errors.push(`steps[${index}] ui.showActionSheet itemList must contain non-empty strings.`);
      }
      break;
    }
    case "location.open": {
      requireNumberField(step, index, "latitude", errors);
      requireNumberField(step, index, "longitude", errors);
      break;
    }
    case "media.getImageInfo": {
      requireStringField(step, index, "src", errors);
      break;
    }
    case "media.saveImageToPhotosAlbum": {
      requireStringField(step, index, "filePath", errors);
      break;
    }
    case "file.stage": {
      requireStringField(step, index, "filePath", errors);
      const hasContent = typeof step.input.content === "string";
      const hasContentBase64 = typeof step.input.contentBase64 === "string";
      if (!hasContent && !hasContentBase64) {
        errors.push(`steps[${index}] file.stage requires content or contentBase64.`);
      }
      if (hasContent && hasContentBase64) {
        errors.push(`steps[${index}] file.stage cannot combine content and contentBase64.`);
      }
      requireOptionalStringField(step, index, "encoding", errors);
      break;
    }
    case "file.upload": {
      requireStringField(step, index, "url", errors);
      requireStringField(step, index, "filePath", errors);
      requireStringField(step, index, "name", errors);
      break;
    }
    case "file.download": {
      requireStringField(step, index, "url", errors);
      break;
    }
    case "device.makePhoneCall": {
      requireStringField(step, index, "phoneNumber", errors);
      break;
    }
    case "assert.networkRequest":
    case "assert.networkResponse": {
      requireOptionalStringField(step, index, "listenerId", errors);
      requireOptionalNumberField(step, index, "count", errors);
      requireOptionalNumberField(step, index, "minCount", errors);
      requireOptionalNumberField(step, index, "maxCount", errors);
      requireOptionalNumberField(step, index, "withinMs", errors);
      requireOptionalStringField(step, index, "orderedAfter", errors);
      requireOptionalStringField(step, index, "orderedBefore", errors);
      validateNetworkMatcher(step.input.matcher, `steps[${index}] ${step.type} matcher`, errors);
      if (step.input.count !== undefined && (step.input.minCount !== undefined || step.input.maxCount !== undefined)) {
        errors.push(`steps[${index}] ${step.type} cannot combine count with minCount or maxCount.`);
      }
      break;
    }
    case "network.intercept.add": {
      requireOptionalStringField(step, index, "ruleId", errors);
      validateNetworkMatcher(step.input.matcher, `steps[${index}] network.intercept.add matcher`, errors, {
        required: true,
      });
      validateInterceptBehavior(step, index, errors);
      break;
    }
    case "network.intercept.remove": {
      requireStringField(step, index, "ruleId", errors);
      break;
    }
    case "network.intercept.clear": {
      break;
    }
    case "subscription.requestMessage": {
      if (!Array.isArray(step.input.tmplIds) || step.input.tmplIds.length === 0) {
        errors.push(`steps[${index}] subscription.requestMessage requires a non-empty tmplIds array.`);
      } else if (step.input.tmplIds.some((item) => typeof item !== "string" || item.trim() === "")) {
        errors.push(`steps[${index}] subscription.requestMessage tmplIds must contain non-empty strings.`);
      }
      break;
    }
    default:
      break;
  }
}

function validateBridgeCommonShape(step: PlanStep, index: number, errors: string[]): void {
  if (!BRIDGE_STEP_TYPES.has(step.type as SupportedStepType)) {
    return;
  }
  if (
    step.input.requiresDeveloperAppId !== undefined &&
    typeof step.input.requiresDeveloperAppId !== "boolean"
  ) {
    errors.push(`steps[${index}] ${step.type} requiresDeveloperAppId must be a boolean when provided.`);
  }
  if (step.input.skipReason !== undefined && typeof step.input.skipReason !== "string") {
    errors.push(`steps[${index}] ${step.type} skipReason must be a string when provided.`);
  }
  if (step.input.timeoutMs !== undefined && typeof step.input.timeoutMs !== "number") {
    errors.push(`steps[${index}] ${step.type} timeoutMs must be numeric when provided.`);
  }
}

function requireStringField(step: PlanStep, index: number, fieldName: string, errors: string[]): void {
  if (typeof step.input[fieldName] !== "string" || !String(step.input[fieldName]).trim()) {
    errors.push(`steps[${index}] ${step.type} requires a non-empty string ${fieldName} value.`);
  }
}

function requireNumberField(step: PlanStep, index: number, fieldName: string, errors: string[]): void {
  if (typeof step.input[fieldName] !== "number" || !Number.isFinite(step.input[fieldName])) {
    errors.push(`steps[${index}] ${step.type} requires a numeric ${fieldName} value.`);
  }
}

function requireOptionalNumberField(step: PlanStep, index: number, fieldName: string, errors: string[]): void {
  if (step.input[fieldName] !== undefined) {
    requireNumberField(step, index, fieldName, errors);
  }
}

function requireOptionalStringField(step: PlanStep, index: number, fieldName: string, errors: string[]): void {
  if (
    step.input[fieldName] !== undefined &&
    (typeof step.input[fieldName] !== "string" || !String(step.input[fieldName]).trim())
  ) {
    errors.push(`steps[${index}] ${step.type} ${fieldName} must be a non-empty string when provided.`);
  }
}

function requireOptionalBooleanField(step: PlanStep, index: number, fieldName: string, errors: string[]): void {
  if (step.input[fieldName] !== undefined && typeof step.input[fieldName] !== "boolean") {
    errors.push(`steps[${index}] ${step.type} ${fieldName} must be a boolean when provided.`);
  }
}

function requireOptionalEnumField(
  step: PlanStep,
  index: number,
  fieldName: string,
  allowedValues: Set<string>,
  errors: string[],
): void {
  if (step.input[fieldName] === undefined) {
    return;
  }
  if (typeof step.input[fieldName] !== "string" || !allowedValues.has(step.input[fieldName] as string)) {
    errors.push(
      `steps[${index}] ${step.type} ${fieldName} must be one of ${Array.from(allowedValues)
        .map((value) => `\`${value}\``)
        .join(", ")} when provided.`,
    );
  }
}

function validateNetworkMatcher(
  matcher: unknown,
  pathPrefix: string,
  errors: string[],
  options: { required?: boolean } = {},
): void {
  if (matcher === undefined) {
    if (options.required) {
      errors.push(`${pathPrefix} is required.`);
    }
    return;
  }
  if (!isRecord(matcher)) {
    errors.push(`${pathPrefix} must be an object.`);
    return;
  }
  for (const key of Object.keys(matcher)) {
    if (!NETWORK_MATCHER_KEYS.has(key as (typeof NETWORK_MATCHER_KEYS extends Set<infer T> ? T : never))) {
      errors.push(`${pathPrefix} has an unsupported field: ${JSON.stringify(key)}.`);
    }
  }
  validateOptionalStringValue(matcher.url, `${pathPrefix}.url`, errors);
  validateOptionalStringValue(matcher.urlPattern, `${pathPrefix}.urlPattern`, errors);
  validateOptionalStringValue(matcher.method, `${pathPrefix}.method`, errors);
  if (matcher.resourceType !== undefined) {
    if (typeof matcher.resourceType !== "string" || !NETWORK_MATCHER_RESOURCE_TYPES.has(matcher.resourceType)) {
      errors.push(
        `${pathPrefix}.resourceType must be one of ${Array.from(NETWORK_MATCHER_RESOURCE_TYPES)
          .map((value) => `\`${value}\``)
          .join(", ")} when provided.`,
      );
    }
  }
  validateOptionalRecordValue(matcher.query, `${pathPrefix}.query`, errors);
  validateOptionalRecordValue(matcher.headers, `${pathPrefix}.headers`, errors);
  validateOptionalRecordValue(matcher.responseHeaders, `${pathPrefix}.responseHeaders`, errors);
  if (matcher.statusCode !== undefined && (typeof matcher.statusCode !== "number" || !Number.isFinite(matcher.statusCode))) {
    errors.push(`${pathPrefix}.statusCode must be numeric when provided.`);
  }
}

function validateInterceptBehavior(step: PlanStep, index: number, errors: string[]): void {
  if (!isRecord(step.input.behavior)) {
    errors.push(`steps[${index}] network.intercept.add requires a behavior object.`);
    return;
  }
  const behavior = step.input.behavior;
  if (typeof behavior.action !== "string" || !NETWORK_INTERCEPT_ACTIONS.has(behavior.action)) {
    errors.push(
      `steps[${index}] network.intercept.add behavior.action must be one of ${Array.from(NETWORK_INTERCEPT_ACTIONS)
        .map((value) => `\`${value}\``)
        .join(", ")}.`,
    );
    return;
  }
  if (behavior.action === "delay") {
    if (typeof behavior.delayMs !== "number" || !Number.isFinite(behavior.delayMs)) {
      errors.push(`steps[${index}] network.intercept.add behavior.delayMs must be numeric for delay actions.`);
    }
  }
  if (behavior.action === "fail") {
    validateOptionalStringValue(
      behavior.errorMessage,
      `steps[${index}] network.intercept.add behavior.errorMessage`,
      errors,
    );
    validateOptionalStringValue(behavior.errorCode, `steps[${index}] network.intercept.add behavior.errorCode`, errors);
  }
  if (behavior.action === "mock") {
    if (!isRecord(behavior.response)) {
      errors.push(`steps[${index}] network.intercept.add behavior.response must be an object for mock actions.`);
      return;
    }
    const response = behavior.response;
    if (response.statusCode !== undefined && (typeof response.statusCode !== "number" || !Number.isFinite(response.statusCode))) {
      errors.push(`steps[${index}] network.intercept.add behavior.response.statusCode must be numeric when provided.`);
    }
    validateOptionalRecordValue(
      response.headers,
      `steps[${index}] network.intercept.add behavior.response.headers`,
      errors,
    );
  }
}

function validateOptionalStringValue(value: unknown, fieldName: string, errors: string[]): void {
  if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
    errors.push(`${fieldName} must be a non-empty string when provided.`);
  }
}

function validateOptionalRecordValue(value: unknown, fieldName: string, errors: string[]): void {
  if (value !== undefined && !isRecord(value)) {
    errors.push(`${fieldName} must be an object when provided.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
