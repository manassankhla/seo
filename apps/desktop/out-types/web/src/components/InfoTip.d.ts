export interface FieldInfo {
    /** One-line description of what the field/column means. */
    info?: string;
    /** Concrete example value or usage hint. Rendered under "Example:" in the tooltip. */
    example?: string;
}
/**
 * Hover/focus tooltip used next to setting labels and table column
 * headers. Renders an [i] icon; the popover surfaces a description and
 * an optional concrete example. `pointer-events-none` lets the mouse
 * pass through, so hovering the icon doesn't block clicks on the
 * column-header sort/resize controls underneath.
 */
export declare function InfoTip({ info, example }: FieldInfo): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=InfoTip.d.ts.map