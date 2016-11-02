const React = require('react');
const {Subject} = require('rx');

const _ = require('lodash');

module.exports = clazz => {
  return (id = Symbol()) => {

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
      reducer:baseReducer = (store, event) => store,
      subStreams:baseSubStreams = {}
    } = clazz;


    const rxComponent = {id, childs, store};

    const events = _(eventsSpec)
      .keys()
      .reduce(
        (memo, eventName) => {
          memo[eventName] = `${id}:${eventsSpec[eventName]}`;
          return memo;
        },
        {}
      );

    rxComponent.events = events;

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

    const subStreamsToMerge$ = _.values(subStreamsOutputs);

    let stream$ = new Subject();

    if (childsStreams.length) {
      childsStreams.forEach(childsStream$ => (stream$ = stream$.merge(childsStream$)));
    }

    if (subStreamsToMerge$.length) {
      subStreamsToMerge$.forEach(subStream$ => (stream$ = stream$.merge(subStream$)));
    }

    rxComponent.stream$ = stream$;

    const populatedStream$ = stream$
      .map(populateEvent);

    const reducer = (store, event) => baseReducer(
        _.cloneDeep(store),
        event,
        rxComponent
      );

    const updateStream$ = stream$
      .scan(reducer, store)
      .filter(state => !_.isEmpty(state))
      .distinctUntilChanged(
        _.identity,
        _.isEqual
      )
      .map(store => {
        rxComponent.store = store;
        return store;
      })
      .share();

    const definition = _.extend(
      _.cloneDeep(clazz),
      {
        id,
        events,
        store,
        reducer,
        childs,

        stream$: populatedStream$,
        updateStream$,
        subStreams,

        getInitialState() {
          return store;
        },

        componentDidMount() {
          if (clazz.componentDidMount) {
            clazz.componentDidMount.apply(this, arguments);
          }
          this.subscribtion = updateStream$
            .forEach(this.setState.bind(this));
        },

        componentWillUnmount() {
          if (clazz.componentWillUnmount) {
            clazz.componentWillUnmount.apply(this, arguments);
          }
          this.subscribtion.dispose();
        }

      }
    );

    const RxComponent = React.createClass(definition);

    RxComponent.id = id;
    RxComponent.events = events;
    RxComponent.store = store;
    RxComponent.reducer = reducer;
    RxComponent.childs = childs;
    RxComponent.events = events;

    RxComponent.stream$ = populatedStream$;
    RxComponent.updateStream$ = updateStream$;
    RxComponent.subStreams = subStreams;

    return RxComponent;

  };

}