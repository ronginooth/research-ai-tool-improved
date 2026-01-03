import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;

export function getVersionString(): string {
  return `ver.${APP_VERSION}`;
}
