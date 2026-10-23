import { Center, Loader } from '@mantine/core';

/** اسکلتون بارگذاری — تا RSC سگمنت آماده شود. */
export default function Loading() {
  return (
    <Center mih="40vh">
      <Loader size="md" aria-label="در حال بارگذاری" />
    </Center>
  );
}
