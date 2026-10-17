'use strict';

Language.load('english').finally(() => {
  Language.applyDocument();
  const app = new App();
  app.start();
});
