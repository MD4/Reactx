const RxEntity = require('./RxEntity');

const _ = require('lodash');

module.exports = clazz => {
  return (id = Symbol()) => {

    const rxEntity = RxEntity(clazz, id);

    _.assign(rxEntity, clazz.exposes(rxEntity));

    return _.extend(
      _.cloneDeep(clazz),
      rxEntity
    );

  };

};