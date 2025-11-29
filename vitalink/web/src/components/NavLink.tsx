import { NavLink as RRNavLink } from "react-router-dom"

type Props = {
  to: string
  className?: string
  activeClassName?: string
  children: React.ReactNode
}

export function NavLink({ to, className, activeClassName, children }: Props) {
  return (
    <RRNavLink
      to={to}
      className={({ isActive }) => [className, isActive && activeClassName].filter(Boolean).join(" ")}
    >
      {children}
    </RRNavLink>
  )
}