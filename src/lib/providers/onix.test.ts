import { decodeEntities, onixDate, parseOnixProduct } from './onix';

/**
 * The real ONIX 3.0 response for 978-83-8196-545-3 — Camus, "Dżuma", PIW 2022
 * — recorded from e-isbn.pl/IsbnWeb/api.xml. One of the three ISBNs that no
 * other free catalogue could answer.
 */
const DZUMA = `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage release="3.0" xmlns="http://ns.editeur.org/onix/3.0/reference">
  <Header><Sender><SenderName>Serwis e-ISBN</SenderName></Sender></Header>
  <Product datestamp="20221102">
    <RecordReference>pl-eisbn-7670946</RecordReference>
    <RecordSourceName>PAŃSTWOWY INSTYTUT WYDAWNICZY</RecordSourceName>
    <ProductIdentifier>
      <ProductIDType>15</ProductIDType>
      <IDValue>9788381965453</IDValue>
    </ProductIdentifier>
    <DescriptiveDetail>
      <ProductForm>BC</ProductForm>
      <TitleDetail>
        <TitleType>01</TitleType>
        <TitleElement>
          <TitleElementLevel>01</TitleElementLevel>
          <TitleText>Dżuma</TitleText>
        </TitleElement>
      </TitleDetail>
      <Contributor>
        <SequenceNumber>1</SequenceNumber>
        <ContributorRole>A01</ContributorRole>
        <PersonNameInverted>Camus, Albert</PersonNameInverted>
        <ContributorDate><ContributorDateRole>50</ContributorDateRole><Date>1913</Date></ContributorDate>
        <ContributorDate><ContributorDateRole>51</ContributorDateRole><Date>1960</Date></ContributorDate>
      </Contributor>
      <Contributor>
        <SequenceNumber>2</SequenceNumber>
        <ContributorRole>B06</ContributorRole>
        <PersonNameInverted>Guze, Joanna</PersonNameInverted>
      </Contributor>
      <EditionNumber>23</EditionNumber>
      <Language><LanguageRole>01</LanguageRole><LanguageCode>pol</LanguageCode></Language>
      <Extent><ExtentType>00</ExtentType><ExtentValue>288</ExtentValue><ExtentUnit>03</ExtentUnit></Extent>
    </DescriptiveDetail>
    <PublishingDetail>
      <Imprint><ImprintName>Państwowy Instytut Wydawniczy</ImprintName></Imprint>
      <Publisher><PublishingRole>01</PublishingRole><PublisherName>PAŃSTWOWY INSTYTUT WYDAWNICZY</PublisherName></Publisher>
      <CityOfPublication>Warszawa</CityOfPublication>
      <PublishingDate><PublishingDateRole>01</PublishingDateRole><Date>20221130</Date></PublishingDate>
      <PublishingDate><PublishingDateRole>09</PublishingDateRole><Date>20221102</Date></PublishingDate>
    </PublishingDetail>
  </Product>
</ONIXMessage>`;

describe('decodeEntities', () => {
  it('decodes the five XML entities and numeric references', () => {
    expect(decodeEntities('Fish &amp; Chips')).toBe('Fish & Chips');
    expect(decodeEntities('&#68;&#x17c;uma')).toBe('Dżuma');
  });
});

describe('onixDate', () => {
  it('reads ONIX date precision as it comes', () => {
    expect(onixDate('20221130')).toBe('2022-11-30');
    expect(onixDate('202211')).toBe('2022-11');
    expect(onixDate('2022')).toBe('2022');
    expect(onixDate('')).toBeNull();
  });
});

describe('a real e-ISBN product', () => {
  const book = parseOnixProduct(DZUMA)!;

  it('finds the ISBN-13 by its identifier type, not by position', () => {
    expect(book.isbn13).toBe('9788381965453');
  });

  it('keeps Polish diacritics intact', () => {
    expect(book.title).toBe('Dżuma');
    expect(book.publisher).toBe('PAŃSTWOWY INSTYTUT WYDAWNICZY');
  });

  it('credits the author and not the translator', () => {
    // Joanna Guze is B06, the translator. Crediting her would be wrong twice:
    // she did not write it, and it would split Camus across two author facets.
    expect(book.authors).toEqual(['Albert Camus']);
  });

  it('takes the publication date, not the record datestamp', () => {
    expect(book.publishedDate).toBe('2022-11-30');
  });

  it('reads the page count off the extent', () => {
    expect(book.pageCount).toBe(288);
  });

  it('reads the language code', () => {
    expect(book.language).toBe('pol');
  });
});

describe('a response with nothing in it', () => {
  it('is null rather than an empty book', () => {
    expect(parseOnixProduct('<ONIXMessage><Header/></ONIXMessage>')).toBeNull();
  });
});

describe('a product with a part number', () => {
  it('folds the volume into the title so two parts are not one book', () => {
    const xml = `<Product><TitleDetail><TitleType>01</TitleType><TitleElement>
      <PartNumber>T. 2</PartNumber><TitleText>Słownik historyczny</TitleText>
      <Subtitle>Ziemie chojeńska /</Subtitle></TitleElement></TitleDetail></Product>`;
    const book = parseOnixProduct(xml)!;
    expect(book.title).toBe('Słownik historyczny (T. 2)');
    expect(book.subtitle).toBe('Ziemie chojeńska');
  });
});
