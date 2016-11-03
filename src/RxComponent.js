const React = require('react');
const RxEntity = require('./RxEntity');

const _ = require('lodash');

module.exports = clazz => {
  return (componentId = Symbol()) => {

    const rxEntity = RxEntity(clazz, componentId);

    const baseDefinition = {

      getInitialState() {
        return rxEntity.store;
      },

      componentDidMount() {
        if (clazz.componentDidMount) {
          clazz.componentDidMount.apply(this, arguments);
        }
        this.subscribtion = rxEntity.updateStream$
          .forEach(this.setState.bind(this));
      },

      componentWillUnmount() {
        if (clazz.componentWillUnmount) {
          clazz.componentWillUnmount.apply(this, arguments);
        }
        this.subscribtion.dispose();
      }

    };

    const definition = _.extend(
      _.cloneDeep(clazz),
      _.assign(baseDefinition, rxEntity)
    );

    const rxComponent = React.createClass(definition);

    return _.assign(rxComponent, rxEntity);

  };

};