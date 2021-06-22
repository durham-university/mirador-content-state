import React from 'react';
import { createSelector } from 'reselect';

import ActionTypes from 'mirador/dist/es/src/state/actions/action-types';
import { getWindow } from 'mirador/dist/es/src/state/selectors/getters';
import { receiveAnnotation, updateViewport } from 'mirador/dist/es/src/state/actions';
import { getCompanionWindowsForContent } from 'mirador/dist/es/src/state/selectors';
import { updateCompanionWindow, addWindow } from 'mirador/dist/es/src/state/actions';

import omit from 'lodash/omit';
import set from 'lodash/fp/set';
import update from 'lodash/fp/update';

import { resolveContentState } from './contentState'; 

import { call, put, takeEvery, select, all } from 'redux-saga/effects'

const ContentStateComponent = ({ TargetComponent, targetProps  }) => (
  <TargetComponent {...targetProps} />
); 


export function addContentState(payload) {
  const id = payload.id;
  return {
    id,
    payload,
    type: 'mirador/ADD_CONTENTSTATE'
  }
}

export function updateContentState(id, payload) {
  return {
    id,
    payload,
    type: 'mirador/UPDATE_CONTENTSTATE',
  };
}

export function removeContentState(id) {
  return {
    id,
    type: 'mirador/REMOVE_CONTENTSTATE',
  };
}


const contentStateReducer = function(state = {}, action) {
  switch(action.type){
    case 'mirador/ADD_CONTENTSTATE':
      return set([action.id], action.payload, state);
    case 'mirador/UPDATE_CONTENTSTATE':
      return update([action.id], orig => ({ ...(orig || {}), ...action.payload }), state);
    case 'mirador/REMOVE_CONTENTSTATE':
      return omit(state, action.id);
    default:
      return state;
  }
}

const windowContentStateSelector = createSelector(
  getWindow,
  state => state.contentStates,
  (window, contentStates) => { return {contentState: contentStates[window.contentStateId], targetIndex: window.contentStateIndex}; }
);
const contentStateWindowIdSelector = createSelector(
  (state, { contentStateId, contentStateIndex}) => Object.keys(state.windows).find( id => state.windows[id].contentStateId == contentStateId && state.windows[id].contentStateIndex == contentStateIndex),
  windowId => windowId
);

const contentStateSaga = function*(){
  yield all([
    takeEvery(ActionTypes.IMPORT_CONFIG, function*(action){
      if(action.config.contentState) {
        const contentState = yield call(resolveContentState, action.config.contentState);
        if(contentState) {
          yield put(addContentState(contentState));

          for(var i=0;i<contentState.targets.length;i++){
            const target = contentState.targets[i];
            yield put(addWindow({view: "single", manifestId: target.manifest, canvasId: target.canvas, selectedAnnotationId: target.annotation, contentStateId: contentState.id, contentStateIndex: i}) );
            const windowId = yield select(contentStateWindowIdSelector, { contentStateId: contentState.id, contentStateIndex: i });

            if(target.annotationBox) {
              const companionWindows = yield select(getCompanionWindowsForContent, { windowId, content: "info" });
              for(var companionWindow of companionWindows) {
                yield put(updateCompanionWindow(windowId, companionWindow.id, { content: "annotations" }));
              }
            }
          }
        }
      }
    } ),
    takeEvery(ActionTypes.REQUEST_CANVAS_ANNOTATIONS, function*( { canvasId, windowId } ){
      const contentState = yield select(windowContentStateSelector, { windowId })
      if(!contentState || !contentState.contentState) return;
      const target = contentState.contentState.targets[contentState.targetIndex];

      if(target.canvas == canvasId) {
        const annotation = target.annotationList;
        if(!annotation) return;
        yield put(receiveAnnotation(canvasId, annotation["@id"], annotation));

        const box = target.annotationBox;
        if(box) {
/*        // TODO: getElementById doesn't really work properly in React  
          const window = document.getElementById(windowId);
          var zoom = 1.0;
          if(window.clientWidth/window.clientHeight > box.w/box.h)
            zoom = 1.0 / (box.h * 1.5 / window.clientHeight * window.clientWidth);
          else
            zoom = 1.0 / (box.w * 1.5);

          yield put(updateViewport(windowId, {
            x: box.x + box.w / 2.0,
            y: box.y + box.h / 2.0,
            zoom: zoom
          }));*/
        }
      }
    } )
  ]);
}

export default {
  name: 'ContentStatePlugin',
  target: 'Workspace',
  mode: 'wrap',
  reducers: {
    contentStates: contentStateReducer,
  },
  saga: contentStateSaga,
  component: ContentStateComponent,
}
