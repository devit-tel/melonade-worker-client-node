import * as R from 'ramda';

export const getPrevState = R.curry(
  (States: { [state: string]: string[] }, nextState: string) => {
    return Object.keys(States).filter((state: string) => {
      return States[state].includes(nextState);
    });
  },
);
