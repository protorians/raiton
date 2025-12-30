
export async function until(condition: () => boolean | Promise<boolean>, interval = 50): Promise<void> {
  return new Promise<void>((resolve) => {
    const check = () => {
      const result = condition();
      if (result instanceof Promise)
        result.then((res) => res ? resolve() : setTimeout(check, interval));
      else ((result) ? resolve() : setTimeout(check, interval))
    }
    check();
  });
}
