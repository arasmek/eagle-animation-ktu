import { withTranslation } from 'react-i18next';

import * as style from './style.module.css';

const LimitWarning = ({ nbFrames = null, nbFramesLimit = 0, t }) => {
  if (nbFramesLimit > 0 && nbFrames >= nbFramesLimit) {
    return <div className={style.notch}>{t('Recommended frames exceeded')}</div>;
  }

  return null;
};

export default withTranslation()(LimitWarning);
