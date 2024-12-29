"use client";

import React, {useEffect} from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";

const Home = () => {
  const router = useRouter(); // Khởi tạo router

  useEffect(() => {
    // Chuyển hướng đến trang "basic-chat" ngay khi component được mount
    router.push("/examples/basic-chat");
  }, [router]);


  const categories = {
    "Basic chat": "basic-chat",
    "Function calling": "function-calling",
    "File search": "file-search",
    All: "all",
  };

  return (
    <main className={styles.main}>
      <div className={styles.title}>
        Explore sample apps built with Assistants API
      </div>
      <div className={styles.container}>
        {Object.entries(categories).map(([name, url]) => (
          <a key={name} className={styles.category} href={`/examples/${url}`}>
            {name}
          </a>
        ))}
      </div>
    </main>
  );
};

export default Home;
