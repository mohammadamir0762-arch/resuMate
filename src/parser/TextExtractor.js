// Interface for anything that can turn an uploaded file into a ResumeDocument.
// JavaScript has no interfaces, so the methods throw until a class overrides them.
export class TextExtractor {
  // eslint-disable-next-line no-unused-vars
  parse(buffer, options) {
    throw new Error(`${this.constructor.name} must implement parse().`);
  }

  // eslint-disable-next-line no-unused-vars
  supports(mimeType) {
    throw new Error(`${this.constructor.name} must implement supports().`);
  }
}
