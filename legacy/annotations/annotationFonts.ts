import type {AnnotationFontFamily} from './annotationTypes';

const FONT_URLS: Record<AnnotationFontFamily, string> = {
  'Space Grotesk': '/fonts/space-grotesk/space-grotesk-600.ttf',
  'General Sans': '/fonts/general-sans/general-sans-600.woff2',
  Default: '/fonts/space-grotesk/space-grotesk-600.ttf',
};

export const resolveAnnotationFontUrl = (family: AnnotationFontFamily): string => FONT_URLS[family] ?? FONT_URLS.Default;
