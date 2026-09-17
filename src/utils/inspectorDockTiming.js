// Docking the inspector narrows the canvas and moves every node. Done on the
// first click of a double-click, it moves the node out from under the second
// click, which is then lost. So a click that would DOCK a closed inspector
// waits until the double-click window has passed; a second click inside the
// window cancels the wait and expands instead. When the inspector is already
// docked, or never reserves canvas width (compact viewports use a sheet), a
// click changes nothing in the layout and the inspector opens at once.
export const shouldDeferInspectorOpen = ({ previewOpen, isInspectorDockable }) =>
  Boolean(isInspectorDockable) && !previewOpen;
