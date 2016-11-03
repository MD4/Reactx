const {Observable, Subject} = require('rx');

const _ = require('lodash');

module.exports = (clazz, id) => {

  const populateEvent = event => {
    event = JSON.parse(JSON.stringify(event));
    if (!event.from) {
      event.from = [];
    }
    event.from.push(id);
    event.key = event.from
      .reverse()
      .concat(event.type)
      .join(':');
    return event;
  };

  const {
    childs = {},
    store = {},
    events: eventsSpec = {},
    reducer:baseReducer = (storeCopy, event) => storeCopy,
    subStreams:baseSubStreams = {}
  } = clazz;


  const rxComponent = {id, childs, store};

  rxComponent.events = _(eventsSpec)
    .keys()
    .reduce(
      (memo, eventName) => {
        memo[eventName] = `${id}:${eventsSpec[eventName]}`;
        return memo;
      },
      {}
    );

  const childsStreams = _(childs)
    .values()
    .map('stream$')
    .value();

  const subStreams = _(baseSubStreams)
    .keys()
    .reduce(
      (memo, subStreamName) => {
        memo[subStreamName] = new Subject();
        return memo;
      },
      {}
    );

  rxComponent.subStreams = subStreams;

  const subStreamsOutputs = {};

  _(subStreams)
    .keys()
    .forEach(
      subStreamName => subStreamsOutputs[subStreamName] =
        baseSubStreams[subStreamName](
          subStreams[subStreamName],
          subStreamsOutputs,
          rxComponent
        ).share()
    );

  const subStreamsToMerge = _.values(subStreamsOutputs);

  let stream$ = new Subject();

  if (childsStreams.length) {
    stream$ = Observable
      .of(...childsStreams)
      .mergeAll();
  }

  if (subStreamsToMerge.length) {
    stream$ = Observable
      .of(
        stream$,
        ...subStreamsToMerge
      )
      .mergeAll();
  }

  stream$ = stream$
    .filter(event => !!event);

  rxComponent.stream$ = stream$
    .map(populateEvent);

  const reducer = (store, event) => baseReducer(
    _.cloneDeep(store),
    event,
    rxComponent
  );

  rxComponent.updateStream$ = stream$
    .scan(reducer, store)
    .filter(state => !_.isEmpty(state))
    .distinctUntilChanged(
      _.identity,
      _.isEqual
    )
    .map(store => _.assign(rxComponent.store, store))
    .share();

  return rxComponent;
};