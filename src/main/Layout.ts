import type { BaseWindow, Rectangle } from "electron";

export const TOP_BAR_HEIGHT = 120;
export const SIDEBAR_WIDTH = 400;

function getContentDimensions(baseWindow: BaseWindow): {
  width: number;
  height: number;
} {
  const [width, height] = baseWindow.getContentSize();
  return { width, height };
}

export function getTopBarBounds(baseWindow: BaseWindow): Rectangle {
  const { width } = getContentDimensions(baseWindow);

  return {
    x: 0,
    y: 0,
    width,
    height: TOP_BAR_HEIGHT,
  };
}

export function getTabBounds(
  baseWindow: BaseWindow,
  sidebarVisible: boolean,
): Rectangle {
  return getTabBoundsForSidebarWidth(
    baseWindow,
    sidebarVisible ? SIDEBAR_WIDTH : 0,
  );
}

export function getTabBoundsForSidebarWidth(
  baseWindow: BaseWindow,
  sidebarWidth: number,
): Rectangle {
  const { width, height } = getContentDimensions(baseWindow);
  const clampedSidebarWidth = Math.min(Math.max(0, sidebarWidth), width);

  return {
    x: 0,
    y: TOP_BAR_HEIGHT,
    width: Math.max(0, width - clampedSidebarWidth),
    height: Math.max(0, height - TOP_BAR_HEIGHT),
  };
}

export function getSidebarBounds(baseWindow: BaseWindow): Rectangle {
  return getSidebarBoundsForWidth(baseWindow, SIDEBAR_WIDTH);
}

export function getSidebarBoundsForWidth(
  baseWindow: BaseWindow,
  sidebarWidth: number,
): Rectangle {
  const { width, height } = getContentDimensions(baseWindow);
  const clampedSidebarWidth = Math.min(Math.max(0, sidebarWidth), width);

  return {
    x: Math.max(0, width - clampedSidebarWidth),
    y: TOP_BAR_HEIGHT,
    width: clampedSidebarWidth,
    height: Math.max(0, height - TOP_BAR_HEIGHT),
  };
}

export function getSlidingSidebarBoundsForVisibleWidth(
  baseWindow: BaseWindow,
  visibleWidth: number,
): Rectangle {
  const { width, height } = getContentDimensions(baseWindow);
  const sidebarWidth = Math.min(SIDEBAR_WIDTH, width);
  const clampedVisibleWidth = Math.min(Math.max(0, visibleWidth), sidebarWidth);

  return {
    x: Math.max(0, width - clampedVisibleWidth),
    y: TOP_BAR_HEIGHT,
    width: sidebarWidth,
    height: Math.max(0, height - TOP_BAR_HEIGHT),
  };
}

export function getHiddenBounds(): Rectangle {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
}
