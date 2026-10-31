import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import BusinessPage from "./BusinessPage.vue";
import CatalogHeader from "../vendor/components/CatalogHeader.vue";
import "./theme.css";
export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("BusinessPage", BusinessPage);
    app.component("CatalogHeader", CatalogHeader);
  },
};
