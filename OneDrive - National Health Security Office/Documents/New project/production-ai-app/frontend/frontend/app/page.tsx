"use client";

import { useEffect, useState } from "react";

// Firebase
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";

// Word
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType
} from "docx";
import { saveAs } from "file-saver";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCzW7VUELVRZ4Hww4fWtMmZxJ7Uby9SZfU",
  authDomain: "nhso4-01-srr.firebaseapp.com",
  projectId: "nhso4-01-srr"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState("login");
  const [password, setPassword] = useState("");
  const [meeting, setMeeting] = useState("1");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "attendances"), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(list);
    });
    return () => unsub();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "attendances", id), { status });
  };

  const filtered = data.filter(x => x.meetingId === meeting);

  const total = filtered.length;
  const present = filtered.filter(x => x.status === "present").length;

  // ✅ EXPORT WORD ตารางราชการ
  const exportWord = async () => {
    const rows = [
      new TableRow({
        children: ["ลำดับ", "ชื่อ", "สถานะ"].map(text =>
          new TableCell({
            children: [new Paragraph({ text, alignment: AlignmentType.CENTER })]
          })
        )
      }),
      ...filtered.map((x, i) =>
        new TableRow({
          children: [
            i + 1,
            x.name,
            x.status === "present" ? "มา" : "ลา"
          ].map(t =>
            new TableCell({
              children: [new Paragraph({ text: String(t), alignment: AlignmentType.CENTER })]
            })
          )
        })
      )
    ];

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows
    });

    const docFile = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: "รายงานการเข้าประชุม",
            alignment: AlignmentType.CENTER
          }),
          new Paragraph(`ครั้งที่ ${meeting}`),
          new Paragraph(`มา ${present} / ${total}`),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(docFile);
    saveAs(blob, `report-${meeting}.docx`);
  };

  // ✅ LOGIN
  if (page === "login") {
    return (
      <div style={{ padding: 20 }}>
        <h3>Login</h3>
        <input
          type="password"
          placeholder="1234"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <br /><br />
        <button onClick={() => password === "1234" && setPage("admin")}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>

      {/* MENU */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setPage("admin")}>Admin</button>{" "}
        <button onClick={() => setPage("report")}>Report</button>
      </div>

      {/* SELECT MEETING */}
      <div style={{ marginBottom: 10 }}>
        Meeting:
        <select value={meeting} onChange={e => setMeeting(e.target.value)}>
          <option value="1">ครั้งที่ 1</option>
          <option value="2">ครั้งที่ 2</option>
        </select>
      </div>

      {/* ✅ ADMIN (เหมือนภาพ) */}
      {page === "admin" && (
        <>
          <h3>เช็คชื่อ</h3>

          <table border={1} cellPadding={6} style={{ width: "100%" }}>
            <thead style={{ background: "#eee" }}>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อ</th>
                <th>เข้าร่วม</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((x, i) => (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.name}</td>
                  <td align="center">
                    <input
                      type="checkbox"
                      checked={x.status === "present"}
                      onChange={(e) =>
                        updateStatus(x.id, e.target.checked ? "present" : "leave")
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>มาแล้ว: {present} / {total}</p>
        </>
      )}

      {/* ✅ REPORT */}
      {page === "report" && (
        <>
          <h3>รายงาน</h3>

          <button onClick={exportWord}>Export Word</button>

          <table border={1} cellPadding={6} style={{ width: "100%", marginTop: 10 }}>
            <thead style={{ background: "#eee" }}>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อ</th>
                <th>สถานะ</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((x, i) => (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.name}</td>
                  <td>{x.status === "present" ? "มา" : "ลา"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
