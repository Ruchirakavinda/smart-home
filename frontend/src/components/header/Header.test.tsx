import { render, screen, fireEvent } from "@testing-library/react";
import Header from "./Header";

// Mock child components
jest.mock("../common/ThemeToggleButton", () => ({
  ThemeToggleButton: () => <div data-testid="theme-toggle" />,
}));
jest.mock("./UserDropdown", () => () => <div data-testid="user-dropdown" />);

describe("Header Component", () => {
  test("renders Header and child components", () => {
    render(<Header onClick={jest.fn()} onToggle={jest.fn()} />);

  
  });

  test("calls onClick when main button is clicked", () => {
    const onClickMock = jest.fn();
    render(<Header onClick={onClickMock} onToggle={jest.fn()} />);

    const mainButton = screen.getByRole("button", { name: /main button/i });
    fireEvent.click(mainButton);
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  test("calls onToggle when hamburger menu is clicked", () => {
    const onToggleMock = jest.fn();
    render(<Header onClick={jest.fn()} onToggle={onToggleMock} />);

    const hamburger = screen.getByLabelText("hamburger-menu");
    fireEvent.click(hamburger);
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });

  test("toggles application menu visibility", () => {
    render(<Header onClick={jest.fn()} onToggle={jest.fn()} />);

    const appMenuButton = screen.getByLabelText("application-menu");
    fireEvent.click(appMenuButton);

    
  });
});
