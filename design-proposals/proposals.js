const tabs = Array.from(document.querySelectorAll(".variant-tab"));
const proposals = Array.from(document.querySelectorAll(".proposal"));

const activateVariant = (target) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.target === target);
  });

  proposals.forEach((proposal) => {
    const isActive = proposal.dataset.variant === target;
    proposal.classList.toggle("is-active", isActive);
    proposal.toggleAttribute("hidden", !isActive);
  });
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activateVariant(tab.dataset.target);
  });
});

activateVariant("terminal");
