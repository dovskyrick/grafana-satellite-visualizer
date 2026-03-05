export interface SimpleOptions {
  assetMode: AssetMode;
  coordinatesType: CoordinatesType;

  pointSize: number;
  pointColor: string;

  modelScale: number;
  modelMinimumPixelSize: number;
  modelMaximumScale: number;
  modelAssetId: number | null;
  modelAssetUri: string | null;

  trajectoryShow: boolean;
  trajectoryWidth: number;
  trajectoryColor: string;
  trajectoryDashLength: number;

  showAttitudeVisualization: boolean;

  showSensorCones: boolean;

  showFOVFootprint: boolean;
  showCelestialFOV: boolean;
  showVisibilityLoS: boolean;

  showUncertaintyEllipsoids: boolean;
  uncertaintyOpacityMode: UncertaintyOpacityMode;
  uncertaintyColor: string;

  showBodyAxes: boolean;
  xAxisColor: string;
  yAxisColor: string;
  zAxisColor: string;
  
  showRADecGrid: boolean;
  raSpacing: number;
  decSpacing: number;
  showGridLabels: boolean;
  gridLabelSize: number;

  locations: Location[];
  locationPointSize: number;
  locationPointColor: string;

  accessToken: string;

  subscribeToDataHoverEvent: boolean;

  showAnimation: boolean;
  showTimeline: boolean;
  showInfoBox: boolean;
  showBaseLayerPicker: boolean;
  showSceneModePicker: boolean;
  showProjectionPicker: boolean;
  showCredits: boolean;
  
  showNadirViewButton: boolean;
}

export enum AssetMode {
  Point = 'Point',
  Model = 'Model',
}

export enum CoordinatesType {
  CartesianFixed = 'CartesianFixed',
  CartesianInertial = 'CartesianInertial',
  Geodetic = 'Geodetic',
}

export enum UncertaintyOpacityMode {
  High = 'High (70%)',      // High-quality data
  Medium = 'Medium (30%)',  // Medium-quality data
  Low = 'Low (10%)',        // Low-quality data
}

export interface Location {
  name: string;
  longitude: number;
  latitude: number;
  altitude: number;
}
