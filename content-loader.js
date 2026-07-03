/**
 * content-loader.js
 * Charge site-content.json et injecte le texte dans tous les éléments
 * marqués data-content="chemin.vers.la.valeur" (notation pointée,
 * les index numériques ciblent les éléments de liste : faq_items.0.question).
 */
(function () {
  function getValue(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  fetch("/site-content.json")
    .then((res) => res.json())
    .then((data) => {
      document.querySelectorAll("[data-content]").forEach((el) => {
        const key = el.getAttribute("data-content");
        const value = getValue(data, key);
        if (value !== undefined && value !== null) {
          el.innerHTML = value;
        }
      });
    })
    .catch((err) => console.error("Erreur de chargement du contenu :", err));
})();
