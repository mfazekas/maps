import React from 'react';
import PropTypes from 'prop-types';
import {NativeModules, requireNativeComponent} from 'react-native';

import {viewPropTypes} from '../utils';
import locationManager from '../modules/location/locationManager';

import Annotation from './annotations/Annotation';
import CircleLayer from './CircleLayer';

const mapboxBlue = 'rgba(51, 181, 229, 100)';

const layerStyles = {
  normal: {
    pluse: {
      circleRadius: 15,
      circleColor: mapboxBlue,
      circleOpacity: 0.2,
      circlePitchAlignment: 'map',
    },
    background: {
      circleRadius: 9,
      circleColor: '#fff',
      circlePitchAlignment: 'map',
    },
    foreground: {
      circleRadius: 6,
      circleColor: mapboxBlue,
      circlePitchAlignment: 'map',
    },
  },
};

const normalIcon = [
  <CircleLayer
    key="mapboxUserLocationPluseCircle"
    id="mapboxUserLocationPluseCircle"
    style={layerStyles.normal.pluse}
  />,
  <CircleLayer
    key="mapboxUserLocationWhiteCircle"
    id="mapboxUserLocationWhiteCircle"
    style={layerStyles.normal.background}
  />,
  <CircleLayer
    key="mapboxUserLocationBlueCicle"
    id="mapboxUserLocationBlueCicle"
    aboveLayerID="mapboxUserLocationWhiteCircle"
    style={layerStyles.normal.foreground}
  />,
];

const compassIcon = null;
const navigationIcon = null;

class UserLocation extends React.Component {
  static propTypes = {
    animated: PropTypes.bool,

    renderMode: PropTypes.oneOf(['normal', 'compass', 'navigation', 'custom']),

    visible: PropTypes.bool,

    onPress: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  static defaultProps = {
    animated: true,
    visible: true,
    renderMode: 'normal',
  };

  static RenderMode = {
    Normal: 'normal',
    Compass: 'compass',
    Navigation: 'navigation',
    Custom: 'custom',
  };

  static TrackingMode = {
    None: 'none',
    Follow: 'follow',
    FollowWithHeading: 'followWithHeading',
    FollowWithCourse: 'followWithCourse',
  };

  constructor(props) {
    super(props);

    this.state = {
      shouldShowUserLocation: false,
      coordinates: null,
    };

    this._onLocationUpdate = this._onLocationUpdate.bind(this);
  }

  async componentDidMount() {
    const lastKnownLocation = await locationManager.getLastKnownLocation();

    if (lastKnownLocation) {
      this.setState({
        coordinates: this._getCoordinatesFromLocation(lastKnownLocation),
      });
    }

    locationManager.addListener(this._onLocationUpdate);
  }

  componentWillUnmount() {
    locationManager.removeListener(this._onLocationUpdate);
  }

  _onLocationUpdate(location) {
    this.setState({
      coordinates: this._getCoordinatesFromLocation(location),
    });

    if (this.props.onUpdate) {
      this.props.onUpdate(location);
    }
  }

  _getCoordinatesFromLocation(location) {
    if (!location || !location.coords) {
      return;
    }
    return [location.coords.longitude, location.coords.latitude];
  }

  get userIconLayers() {
    switch (this.props.renderMode) {
      case UserLocation.RenderMode.Normal:
        return normalIcon;
      case UserLocation.RenderMode.Compass:
        return compassIcon;
      case UserLocation.RenderMode.Navigation:
        return navigationIcon;
      default:
        return this.props.children;
    }
  }

  render() {
    if (!this.props.visible || !this.state.coordinates) {
      return null;
    }

    const children = this.props.children
      ? this.props.children
      : this.userIconLayers;
    return (
      <Annotation
        animated={this.props.animated}
        id="mapboxUserLocation"
        onPress={this.props.onPress}
        coordinates={this.state.coordinates}
      >
        {children}
      </Annotation>
    );
  }
}

export default UserLocation;
