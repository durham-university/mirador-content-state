import React from 'react';
import { createSelector } from 'reselect';
import mirador from 'mirador';

import ActionTypes from 'mirador/dist/es/src/state/actions/action-types';
import { getWindow, getManifest } from 'mirador/dist/es/src/state/selectors/getters';
import { receiveAnnotation, receiveManifest, updateViewport } from 'mirador/dist/es/src/state/actions';
import { getCompanionWindowsForContent } from 'mirador/dist/es/src/state/selectors';
import { updateWindow, updateCompanionWindow, addWindow } from 'mirador/dist/es/src/state/actions';

import omit from 'lodash/omit';
import set from 'lodash/fp/set';
import update from 'lodash/fp/update';

import fetch from 'isomorphic-unfetch';

import {  contentStateFromLocation, 
          parseContentState, 
          getContentStateManifest, 
          getContentStateCanvas, 
          getContentStateAnnotation, 
          getContentStateBox 
      } from './contentState'; 

import { call, put, takeEvery, takeLatest, select, all } from 'redux-saga/effects'
import { Select } from '@material-ui/core';

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
  (window, contentStates) => contentStates[window.contentStateId]  
);
const contentStateSelector = createSelector(
  (state, { contentStateId }) => contentStateId,
  state => state.contentStates,
  (contentStateId, contentStates) => contentStates[contentStateId]
);

const contentStateSaga = function*(){
  function* handleWindowContentState( action ){
    const {contentState, contentStateId, windowId} = (() => {
      switch(action.type) {
        case ActionTypes.ADD_WINDOW:
          return {contentState: action.window.contentState, contentStateId: action.window.contentStateId, windowId: action.window.id};
        case ActionTypes.UPDATE_WINDOW:
          return {contentState: action.payload.contentState, contentStateId: action.payload.contentStateId, windowId: action.id};
        default:
          return undefined;
      }
    })();

    if((!contentState && !contentStateId) || !windowId) return;
    
    if(contentState) {
      var contentStateJson = (contentState === true) ? parseContentState(contentStateFromLocation()) : parseContentState(contentState);
      if(!contentStateJson) return;

      if(contentStateJson.reference) {
        var fetchWrapper = async function(url) {
          const response = await fetch(url);
          if (response.ok) {
            const json = await response.json();
            return Promise.resolve({ reference: false, id: url, json: json });
          }
          else
            return Promise.reject({ error: response.statusText, json, response });
        }
        contentStateJson = yield call(fetchWrapper, contentStateJson.id);
      }
      yield put(addContentState(contentStateJson));
      yield put(updateWindow(windowId, {contentState: undefined, contentStateId: contentStateJson.id}))
    }
    else if(contentStateId){
      const contentState = yield select(contentStateSelector, { contentStateId: contentStateId })
      if(!contentState) return;

      const annotationList = getContentStateAnnotation(contentState.json);
      const annotationId = annotationList ? annotationList["resources"][0]["@id"] : undefined;

      yield put(updateWindow(windowId, {manifestId: getContentStateManifest(contentState.json), canvasId: getContentStateCanvas(contentState.json), selectedAnnotationId: annotationId} ));

      if(annotationId) {
        const companionWindows = yield select(getCompanionWindowsForContent, { windowId, content: "info" });
        for(var companionWindow of companionWindows) {
          yield put(updateCompanionWindow(windowId, companionWindow.id, { content: "annotations" }));
        }

        const box = getContentStateBox(contentState.json);
        if(box) {
          const state = yield select();
          console.log(state);

          // TODO: zoom factor should take into account viewer geometry
          yield put(updateViewport(windowId, {
            x: box.x + box.w / 2.0,
            y: box.y + box.h / 2.0,
            zoom: 1.0 / (box.w * 3)
          }));
        }        
      }
    }
  }

  yield all([
    takeEvery(ActionTypes.ADD_WINDOW, handleWindowContentState ),
    takeEvery(ActionTypes.UPDATE_WINDOW, handleWindowContentState ),
    takeEvery(ActionTypes.IMPORT_CONFIG, function*(action){
      if(action.config.contentState) {
        yield put(addWindow({ view: "single", contentState: action.config.contentState}));
      }
    } ),
    takeEvery(ActionTypes.REQUEST_CANVAS_ANNOTATIONS, function*( { canvasId, windowId } ){
      const contentState = yield select(windowContentStateSelector, { windowId })
      if(!contentState) return;
      const annotation = getContentStateAnnotation(contentState.json);
      if(!annotation) return;
      yield put(receiveAnnotation(canvasId, annotation["@id"], annotation));
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
