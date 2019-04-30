import React from 'react';
import PropTypes from 'prop-types';

import {
  NativeModules,
  requireNativeComponent,
} from 'react-native';

import NativeBridgeComponent from './NativeBridgeComponent';
import locationManager from '../modules/location/locationManager';

import {
  isNumber,
  toJSONString,
  viewPropTypes,
  existenceChange,
} from '../utils';

import * as geoUtils from '../utils/geoUtils';

const MapboxGL = NativeModules.MGLModule;

export const NATIVE_MODULE_NAME = 'RCTMGLCamera';

class Camera extends NativeBridgeComponent {
  static propTypes = {
    ...viewPropTypes,

    animationDuration: PropTypes.number,

    animationMode: PropTypes.oneOf([
      'flyTo',
      'easeTo',
      'moveTo',
    ]),

    // normal
    centerCoordinate: PropTypes.arrayOf(PropTypes.number),
    heading: PropTypes.number,
    pitch: PropTypes.number,
    bounds: PropTypes.arrayOf(PropTypes.number),
    zoomLevel: PropTypes.number,
    minZoomLevel: PropTypes.number,
    maxZoomLevel: PropTypes.number,

    // user tracking
    followUserLocation: PropTypes.bool,

    followUserMode: PropTypes.oneOf([
      'normal',
      'compass',
      'course',
    ]),

    followZoomLevel: PropTypes.number,
    followPitch: PropTypes.number,
    followHeading: PropTypes.number,

    // manual update
    triggerKey: PropTypes.any,

    // position
    alignment: PropTypes.arrayOf(PropTypes.number),
  };

  static defaultProps = {
    animationMode: 'easeTo',
    animationDuration: 2000,
    isUserInteraction: false,
  };

  static Mode = {
    Flight: 'flyTo',
    Move: 'moveTo',
    Ease: 'easeTo',
  };

  componentWillReceiveProps (nextProps) {
    this._handleCameraChange(this.props, nextProps);
  }

  shouldComponentUpdate () {
    return false;
  }

  _handleCameraChange (currentCamera, nextCamera) {
    const hasCameraChanged = this._hasCameraChanged(currentCamera, nextCamera);
    if (!hasCameraChanged) {
      return;
    }

    if (currentCamera.followUserLocation && !nextCamera.followUserLocation) {
      this.refs.camera.setNativeProps({ followUserLocation: false });
      return;
    } else if (!currentCamera.followUserLocation && nextCamera.followUserLocation) {
      this.refs.camera.setNativeProps({ followUserLocation: true });
    }

    if (nextCamera.followUserLocation) {
      this.refs.camera.setNativeProps({
        followPitch: nextCamera.followPitch || nextCamera.pitch,
        followHeading: nextCamera.followHeading || nextCamera.heading,
        followZoomLevel: nextCamera.followZoomLevel || nextCamera.zoomLevel,
      });
      return;
    }

    let cameraConfig = {
      animationMode: nextCamera.animationMode,
      animationDuration: nextCamera.animationDuration,
      zoomLevel: nextCamera.zoomLevel,
      pitch: nextCamera.pitch,
      heading: nextCamera.heading,
    };

    if (nextCamera.bounds && this._hasBoundsChanged(currentCamera, nextCamera)) {
      cameraConfig.bounds = nextCamera.bounds;
    } else {
      cameraConfig.centerCoordinate = nextCamera.centerCoordinate;
    }

    this._setCamera(cameraConfig);
  }

  _hasCameraChanged (currentCamera, nextCamera) {
    const c = currentCamera;
    const n = nextCamera;

    const hasDefaultPropsChanged =
      c.heading !== n.heading ||
      this._hasCenterCoordinateChanged(c, n) ||
      this._hasBoundsChanged(c, n) ||
      c.pitch !== n.pitch ||
      c.zoomLevel !== n.zoomLevel ||
      c.triggerKey !== n.triggerKey;

    const hasFollowPropsChanged =
      c.followUserLocation !== n.followUserLocation ||
      c.followUserMode !== n.followUserMode ||
      c.followZoomLevel !== n.followZoomLevel ||
      c.followHeading !== n.followHeading ||
      c.followPitch !== n.followPitch;

    const hasAnimationPropsChanged =
      c.animationMode !== n.animationMode ||
      c.animationDuration !== n.animationDuration;

    return hasDefaultPropsChanged || hasFollowPropsChanged || hasAnimationPropsChanged;
  }

  _hasCenterCoordinateChanged (currentCamera, nextCamera) {
    const cC = currentCamera.centerCoordinate;
    const nC = nextCamera.centerCoordinate;

    if (existenceChange(cC, nC)) {
      return true;
    }

    if (!cC && !nC) {
      return false;
    }

    const isLngDiff = currentCamera.centerCoordinate[0] !== nextCamera.centerCoordinate[0];
    const isLatDiff = currentCamera.centerCoordinate[1] !== nextCamera.centerCoordinate[1]
    return isLngDiff || isLatDiff;
  }

  _hasBoundsChanged (currentCamera, nextCamera) {
    const cB = currentCamera.bounds;
    const nB = nextCamera.bounds;

    if (!cB && !nB) {
      return false;
    }

    if (existenceChange(cB, nB)) {
      return true;
    }

    return (
      !!cB.bounds !== !!nB.bounds ||
      cB.bounds[0][0] !== nB.bounds[0][0] ||
      cB.bounds[0][1] !== nB.bounds[0][1] ||
      cB.bounds[1][0] !== nB.bounds[1][0] ||
      cB.bounds[1][1] !== nB.bounds[1][1]
    );
  }

  _setCamera(config = {}) {
    let cameraConfig = {};

    if (config.stops) {
      cameraConfig.stops = [];

      for (let stop of config.stops) {
        cameraConfig.stops.push(this._createStopConfig(stop));
      }
    } else {
      cameraConfig = this._createStopConfig(config);
    }

    this.refs.camera.setNativeProps({ stop: cameraConfig });
  }

  _createStopConfig(config = {}) {
    if (this.props.followUserLocation) {
      return null;
    }

    let stopConfig = {
      mode: this._getNativeCameraMode(config),
      pitch: config.pitch,
      heading: config.heading,
      duration: config.animationDuration || 0,
      zoom: config.zoomLevel,
    };

    if (config.centerCoordinate) {
      stopConfig.centerCoordinate = toJSONString(
        geoUtils.makePoint(config.centerCoordinate),
      );
    }

    if (config.bounds && config.bounds.ne && config.bounds.sw) {
      const {
        ne,
        sw,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
      } = config.bounds;
      stopConfig.bounds = toJSONString(makeLatLngBounds(ne, sw));
      stopConfig.boundsPaddingTop = paddingTop || 0;
      stopConfig.boundsPaddingRight = paddingRight || 0;
      stopConfig.boundsPaddingBottom = paddingBottom || 0;
      stopConfig.boundsPaddingLeft = paddingLeft || 0;
    }

    return stopConfig;
  }

  _getNativeCameraMode(config) {
    switch (config.animationMode) {
      case Camera.Mode.Flight:
        return MapboxGL.CameraModes.Flight;
      case Camera.Mode.Move:
        return MapboxGL.CameraModes.None;
      default:
        return MapboxGL.CameraModes.Ease;
    }
  }

  _getAlignment(coordinate, zoomLevel) {
    let region = geoUtils.getOrCalculateVisibleRegion(
      coordinate,
      zoomLevel,
      this.props._mapWidth,
      this.props._mapHeight,
      this.props._region,
    );

    const topLeftCorner = [region.sw[0], region.ne[1]];
    const topRightCorner = [region.ne[0], region.ne[1]];
    const bottomLeftCorner = [region.sw[0], region.sw[1]];

    const verticalLineString = geoUtils.makeLineString([
      topLeftCorner, bottomLeftCorner,
    ]);

    const horizontalLineString = geoUtils.makeLineString([
      topLeftCorner, topRightCorner,
    ]);

    const distVertical = geoUtils.calculateDistance(topLeftCorner, bottomLeftCorner);
    const distHorizontal = geoUtils.calculateDistance(topLeftCorner, topRightCorner);

    const verticalPoint = geoUtils.pointAlongLine(
      verticalLineString,
      distVertical * this.props.alignment[0],
    );

    const horizontalPoint = geoUtils.pointAlongLine(
      horizontalLineString,
      distHorizontal * this.props.alignment[1],
    );

    return [verticalPoint[0], horizontalPoint[1]];
  }

  render () {
    const props = Object.assign({}, this.props);

    return (
      <RCTMGLCamera
        ref='camera'
        followUserLocation={this.props.followUserLocation}
        followUserMode={this.props.followUserMode}
        followUserPitch={this.props.followUserPitch}
        followHeading={this.props.followHeading}
        followZoomLevel={this.props.followZoomLevel}
        stop={this._createStopConfig(props)} />
    );
  }
}

const RCTMGLCamera = requireNativeComponent(NATIVE_MODULE_NAME, Camera, {
  nativeOnly: {
    stop: true,
  },
});

export default Camera;
