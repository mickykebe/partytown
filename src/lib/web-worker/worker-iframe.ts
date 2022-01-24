import { environments, InstanceIdKey, webWorkerCtx } from './worker-constants';
import { getEnv } from './worker-environment';
import { getInstanceStateValue, setInstanceStateValue } from './worker-state';
import { getPartytownScript, resolveUrl } from './worker-exec';
import { HTMLSrcElementDescriptorMap } from './worker-src-element';
import type { Node } from './worker-node';
import { SCRIPT_TYPE } from '../utils';
import { sendToMain, setter } from './worker-proxy';
import { StateProp, WorkerMessageType } from '../types';

export const HTMLIFrameDescriptorMap: PropertyDescriptorMap & ThisType<Node> = {
  contentDocument: {
    get() {
      return (this as any).contentWindow.document;
    },
  },

  contentWindow: {
    get() {
      // the winId of an iframe's window is the same
      // as the instanceId of the containing iframe element
      return environments[this[InstanceIdKey]].$window$;
    },
  },

  src: {
    get() {
      let src = environments[this[InstanceIdKey]].$location$.href;
      if (src.startsWith('about')) {
        src = '';
      }
      return src;
    },
    set(url: string) {
      let xhr = new XMLHttpRequest();
      let xhrStatus: number;
      let winId = this[InstanceIdKey];
      let env = environments[winId];

      env.$location$.href = url = resolveUrl(getEnv(this), url);
      env.$isLoading$ = 1;

      setInstanceStateValue(this, StateProp.loadErrorStatus, undefined);

      xhr.open('GET', url, false);
      xhr.send();
      xhrStatus = xhr.status;

      if (xhrStatus > 199 && xhrStatus < 300) {
        setter(
          this,
          ['srcdoc'],
          `<base href="${url}">` +
            xhr.responseText
              .replace(/<script>/g, `<script type="${SCRIPT_TYPE}">`)
              .replace(/<script /g, `<script type="${SCRIPT_TYPE}" `)
              .replace(/text\/javascript/g, SCRIPT_TYPE) +
            getPartytownScript()
        );

        sendToMain(true);
        webWorkerCtx.$postMessage$([WorkerMessageType.InitializeNextScript, winId]);
      } else {
        setInstanceStateValue(this, StateProp.loadErrorStatus, xhrStatus);
        env.$isLoading$ = 0;
      }
    },
  },

  ...HTMLSrcElementDescriptorMap,
};
